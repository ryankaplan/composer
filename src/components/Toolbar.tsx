import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { useObservable } from "../lib/observable";
import { model } from "../lead-sheet/LeadSheetModel";

export function Toolbar() {
  const timeSignature = useObservable(model.timeSignature);
  const currentDuration = useObservable(model.currentDuration);
  const pendingAccidental = useObservable(model.pendingAccidental);
  const caret = useObservable(model.caret);
  const events = useObservable(model.events);

  function handleTimeSignatureChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const beatsPerBar = parseInt(e.target.value) as 3 | 4;
    model.setTimeSignature({ beatsPerBar, beatUnit: 4 });
  }

  return (
    <Flex
      as="nav"
      bg="gray.100"
      borderBottom="1px solid"
      borderColor="gray.300"
      px={4}
      py={2}
      gap={6}
      alignItems="center"
      flexWrap="wrap"
    >
      <Box display="flex" alignItems="center" gap={2}>
        <label htmlFor="time-sig">Time:</label>
        <select
          id="time-sig"
          value={timeSignature.beatsPerBar}
          onChange={handleTimeSignatureChange}
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: "white",
          }}
        >
          <option value="3">3/4</option>
          <option value="4">4/4</option>
        </select>
      </Box>

      <Box>
        Duration: <strong>{currentDuration}</strong>
      </Box>

      {pendingAccidental && (
        <Box color="blue.600">
          Accidental: <strong>{pendingAccidental}</strong>
        </Box>
      )}

      <Box>
        Caret: {caret} / {events.length}
      </Box>
    </Flex>
  );
}
