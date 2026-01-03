// Composition store - manages composition list, current selection, and persistence

import { Observable } from "../lib/observable";
import { doc } from "../lead-sheet/Document";
import { playbackEngine } from "../playback/engine";
import { CompositionDB } from "./indexeddb";
import { PersistedCompositionV1, generateCuteTitle } from "./schema";
import { serializeDocumentToV1, applyV1ToDocument } from "./serialize";

export class CompositionStore {
  // Observable state
  readonly compositions = new Observable<PersistedCompositionV1[]>([]);
  readonly currentCompositionId = new Observable<string | null>(null);

  private db = new CompositionDB();
  private saveTimeoutId: number | null = null;
  private isLoadingComposition = false;

  /**
   * Initialize the store: open DB, load compositions, select initial composition.
   */
  async init(): Promise<void> {
    await this.db.open();

    // Load composition list
    const compositions = await this.db.listCompositions();
    this.compositions.set(compositions);

    // Load meta to get last opened composition
    const meta = await this.db.getMeta();
    let selectedId = meta?.lastOpenedCompositionId || null;

    // If no compositions exist, create a default one
    if (compositions.length === 0) {
      const newComposition = this.createNewComposition();
      await this.db.putComposition(newComposition);
      this.compositions.set([newComposition]);
      selectedId = newComposition.id;
    }

    // If selectedId is not in the list, fall back to the first composition
    if (selectedId && !compositions.find((c) => c.id === selectedId)) {
      selectedId = compositions[0]?.id || null;
    }

    // If still no selectedId, use the first composition
    if (!selectedId && compositions.length > 0) {
      selectedId = compositions[0]!.id;
    }

    // Load the selected composition
    if (selectedId) {
      await this.loadComposition(selectedId);
    }

    // Wire up autosave
    this.setupAutosave();
  }

  /**
   * Create a new composition with default content.
   */
  private createNewComposition(): PersistedCompositionV1 {
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      title: generateCuteTitle(),
      createdAt: now,
      updatedAt: now,
      leadSheet: serializeDocumentToV1(doc),
    };
  }

  /**
   * Load a composition into the document.
   */
  async loadComposition(id: string): Promise<void> {
    this.isLoadingComposition = true;

    // Stop playback before switching
    if (playbackEngine.isPlaying.get()) {
      playbackEngine.stop();
    }

    const composition = await this.db.getComposition(id);
    if (!composition) {
      console.error(`Composition ${id} not found`);
      this.isLoadingComposition = false;
      return;
    }

    // Apply to document
    applyV1ToDocument(doc, composition.leadSheet);

    // Update current composition ID
    this.currentCompositionId.set(id);

    // Save as last opened
    await this.db.putMeta({
      schemaVersion: 1,
      lastOpenedCompositionId: id,
    });

    this.isLoadingComposition = false;
  }

  /**
   * Create a new composition and switch to it.
   */
  async createComposition(): Promise<void> {
    const newComposition = this.createNewComposition();
    await this.db.putComposition(newComposition);

    // Add to list
    const compositions = this.compositions.get();
    this.compositions.set([newComposition, ...compositions]);

    // Load it
    await this.loadComposition(newComposition.id);
  }

  /**
   * Duplicate an existing composition.
   */
  async duplicateComposition(id: string): Promise<void> {
    const original = await this.db.getComposition(id);
    if (!original) return;

    const now = Date.now();
    const duplicate: PersistedCompositionV1 = {
      id: crypto.randomUUID(),
      title: `${original.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      leadSheet: { ...original.leadSheet },
    };

    await this.db.putComposition(duplicate);

    // Add to list
    const compositions = this.compositions.get();
    this.compositions.set([duplicate, ...compositions]);

    // Load it
    await this.loadComposition(duplicate.id);
  }

  /**
   * Delete a composition.
   */
  async deleteComposition(id: string): Promise<void> {
    await this.db.deleteComposition(id);

    // Remove from list
    const compositions = this.compositions.get();
    const filtered = compositions.filter((c) => c.id !== id);
    this.compositions.set(filtered);

    // If we deleted the current composition, switch to another
    if (this.currentCompositionId.get() === id) {
      if (filtered.length > 0) {
        await this.loadComposition(filtered[0]!.id);
      } else {
        // No compositions left, create a new one
        await this.createComposition();
      }
    }
  }

  /**
   * Update the title of the current composition.
   */
  async updateCurrentTitle(newTitle: string): Promise<void> {
    const currentId = this.currentCompositionId.get();
    if (!currentId) return;

    const composition = await this.db.getComposition(currentId);
    if (!composition) return;

    const updated: PersistedCompositionV1 = {
      ...composition,
      title: newTitle,
      updatedAt: Date.now(),
    };

    await this.db.putComposition(updated);

    // Update in list
    const compositions = this.compositions.get();
    const updatedList = compositions.map((c) =>
      c.id === currentId ? updated : c
    );
    this.compositions.set(updatedList);
  }

  /**
   * Save the current document state to the current composition.
   */
  async saveCurrentComposition(): Promise<void> {
    const currentId = this.currentCompositionId.get();
    if (!currentId || this.isLoadingComposition) return;

    const composition = await this.db.getComposition(currentId);
    if (!composition) return;

    const updated: PersistedCompositionV1 = {
      ...composition,
      leadSheet: serializeDocumentToV1(doc),
      updatedAt: Date.now(),
    };

    await this.db.putComposition(updated);

    // Update in list (to reflect new updatedAt timestamp)
    const compositions = this.compositions.get();
    const updatedList = compositions.map((c) =>
      c.id === currentId ? updated : c
    );
    // Re-sort by updatedAt
    updatedList.sort((a, b) => b.updatedAt - a.updatedAt);
    this.compositions.set(updatedList);
  }

  /**
   * Setup autosave watcher on document changes.
   */
  private setupAutosave(): void {
    const scheduleAutosave = () => {
      if (this.saveTimeoutId !== null) {
        clearTimeout(this.saveTimeoutId);
      }

      this.saveTimeoutId = setTimeout(() => {
        this.saveCurrentComposition();
        this.saveTimeoutId = null;
      }, 500) as unknown as number;
    };

    // Watch for changes to document content
    doc.events.register(scheduleAutosave);
    doc.chords.register(scheduleAutosave);
    doc.timeSignature.register(scheduleAutosave);
    doc.keySignature.register(scheduleAutosave);
    doc.explicitEndUnit.register(scheduleAutosave);
  }
}

// Global singleton instance
export const compositionStore = new CompositionStore();
