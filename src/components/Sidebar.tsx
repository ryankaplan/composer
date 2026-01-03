import React, { useState } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useObservable } from "../lib/observable";
import { compositionStore } from "../compositions/store";
import { PersistedCompositionV1 } from "../compositions/schema";
import { FaIcon } from "./FaIcon";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const MotionBox = motion.create(Box);

export function Sidebar(props: SidebarProps) {
  const { isOpen, onClose } = props;
  const compositions = useObservable(compositionStore.compositions);
  const currentCompositionId = useObservable(
    compositionStore.currentCompositionId
  );

  function handleNewComposition() {
    compositionStore.createComposition();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <MotionBox
            position="fixed"
            top="56px"
            left="0"
            right="0"
            bottom="0"
            bg="blackAlpha.400"
            zIndex="998"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Sidebar panel */}
          <MotionBox
            position="fixed"
            top="56px"
            left="0"
            bottom="0"
            width="280px"
            bg="white"
            borderRight="1px solid"
            borderColor="border"
            zIndex="999"
            overflowY="auto"
            boxShadow="lg"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header with New button */}
            <Flex
              px={4}
              py={3}
              borderBottom="1px solid"
              borderColor="gray.100"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box fontSize="sm" fontWeight="semibold" color="gray.700">
                Compositions
              </Box>
              <button
                onClick={handleNewComposition}
                style={{
                  background: "transparent",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  padding: "4px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#4a5568",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f7fafc";
                  e.currentTarget.style.borderColor = "#cbd5e0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }}
              >
                + New
              </button>
            </Flex>

            {/* Composition list */}
            <Box py={2}>
              {compositions.map((composition) => (
                <CompositionRow
                  key={composition.id}
                  composition={composition}
                  isActive={composition.id === currentCompositionId}
                />
              ))}
            </Box>
          </MotionBox>
        </>
      )}
    </AnimatePresence>
  );
}

type CompositionRowProps = {
  composition: PersistedCompositionV1;
  isActive: boolean;
};

function CompositionRow(props: CompositionRowProps) {
  const { composition, isActive } = props;
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    compositionStore.loadComposition(composition.id);
    // Prevent scroll jump by keeping the clicked element in view
    e.currentTarget.scrollIntoView({ block: "nearest", behavior: "auto" });
  }

  function handleMenuToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    compositionStore.duplicateComposition(composition.id);
    setMenuOpen(false);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`Delete "${composition.title}"?`)) {
      compositionStore.deleteComposition(composition.id);
    }
    setMenuOpen(false);
  }

  return (
    <Box
      position="relative"
      px={3}
      py={2}
      mx={2}
      borderRadius="4px"
      bg={isActive ? "gray.100" : isHovered ? "gray.50" : "transparent"}
      cursor="pointer"
      transition="all 0.15s ease"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMenuOpen(false);
      }}
      onClick={handleClick}
    >
      <Flex alignItems="center" justifyContent="space-between" minHeight="24px">
        <Box
          fontSize="sm"
          color={isActive ? "gray.900" : "gray.700"}
          fontWeight={isActive ? "medium" : "normal"}
          flex="1"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {composition.title}
        </Box>

        {/* Three-dots menu button */}
        <Box
          onClick={handleMenuToggle}
          color={isHovered || menuOpen ? "gray.500" : "transparent"}
          _hover={{ color: "gray.700" }}
          transition="color 0.15s ease"
          display="flex"
          alignItems="center"
          justifyContent="center"
          width="24px"
          height="24px"
          borderRadius="4px"
          bg={menuOpen ? "gray.200" : "transparent"}
          _hoverBg="gray.200"
          pointerEvents={isHovered || menuOpen ? "auto" : "none"}
        >
          <FaIcon name="ellipsis-h" style={{ fontSize: "14px" }} />
        </Box>
      </Flex>

      {/* Dropdown menu */}
      {menuOpen && (
        <Box
          position="absolute"
          top="100%"
          right="8px"
          mt={1}
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="6px"
          boxShadow="lg"
          zIndex="1000"
          minWidth="140px"
          py={1}
        >
          <MenuItem icon="copy" label="Duplicate" onClick={handleDuplicate} />
          <MenuItem
            icon="trash"
            label="Delete"
            onClick={handleDelete}
            destructive
          />
        </Box>
      )}
    </Box>
  );
}

type MenuItemProps = {
  icon: string;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  destructive?: boolean;
};

function MenuItem(props: MenuItemProps) {
  const { icon, label, onClick, destructive } = props;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      px={3}
      py={2}
      alignItems="center"
      gap={2}
      cursor="pointer"
      bg={isHovered ? (destructive ? "red.50" : "gray.50") : "transparent"}
      color={destructive ? "red.600" : "gray.700"}
      fontSize="sm"
      transition="all 0.15s ease"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <FaIcon name={icon} style={{ fontSize: "14px", width: "14px" }} />
      <Box>{label}</Box>
    </Flex>
  );
}
