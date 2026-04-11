/**
 * @file SectionManager.tsx
 * @description Modal for managing task page sections (like Kanban columns)
 * @app TASKS - Task page section management
 * 
 * A modal dialog for creating, editing, and reordering task page sections.
 * Sections act like Kanban columns within a task page and tasks can be
 * assigned to specific sections.
 * 
 * Features:
 * - Create new sections with name and color
 * - Edit existing section name and color
 * - Delete sections
 * - Drag-and-drop reordering of sections
 * - Preset color palette selection
 * 
 * Accessed via 'Manage Sections' in TasksView header when viewing a task page.
 */
import React, { useState, useCallback } from 'react';
import type { Section } from '@/types/page';
import { PlusIcon } from '../common/Icons';
import { Modal, H2, Button, Input, ColorPicker, Panel, MobileSheet } from '@/components/ui';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

interface SectionManagerProps {
  sections: Section[];
  onAddSection: (name: string, color: string) => void;
  onEditSection: (sectionId: string, name: string, color: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (sectionId: string, targetId: string) => void;
  onClose: () => void;
}

const SECTION_COLORS = [
  '#EF4444', // red
  '#F59E0B', // orange
  '#10B981', // green
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#9CA3AF', // gray
];

const SectionManager: React.FC<SectionManagerProps> = ({
  sections,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onReorderSections,
  onClose,
}) => {
  const isMobile = useIsMobile();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SECTION_COLORS[0]);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  
  // Delete confirmation
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Handle section delete with confirmation
  const handleDeleteSection = useCallback((section: Section) => {
    requestDelete({
      itemType: 'page', // Using 'page' for section since it's a subtype
      count: 1,
      customMessage: `Are you sure you want to delete the section "${section.name}"?`,
      onConfirm: () => onDeleteSection(section.id),
    });
  }, [requestDelete, onDeleteSection]);

  const handleStartEdit = (section: Section) => {
    setEditingId(section.id);
    setEditingName(section.name);
    setEditingColor(section.color || SECTION_COLORS[0]);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onEditSection(editingId, editingName.trim(), editingColor);
      setEditingId(null);
      setEditingName('');
      setEditingColor('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingColor('');
  };

  const handleAddSection = () => {
    if (newName.trim()) {
      onAddSection(newName.trim(), newColor);
      setNewName('');
      setNewColor(SECTION_COLORS[0]);
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor(SECTION_COLORS[0]);
  };

  const handleDragStart = (sectionId: string) => {
    setDraggedSectionId(sectionId);
  };

  const handleDragEnd = () => {
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedSectionId && draggedSectionId !== targetId) {
      setDragOverSectionId(targetId);
    }
  };

  const handleDrop = (targetId: string) => {
    if (draggedSectionId && draggedSectionId !== targetId) {
      onReorderSections(draggedSectionId, targetId);
    }
    setDraggedSectionId(null);
    setDragOverSectionId(null);
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const sectionContent = (
    <div className="space-y-4 pt-2 pb-6">
        {/* Section List */}
        <div className="space-y-2">
          {sortedSections.map((section) => (
            <div
              key={section.id}
              draggable={editingId !== section.id}
              onDragStart={() => handleDragStart(section.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, section.id)}
              onDrop={() => handleDrop(section.id)}
              className={`flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)] group ${
                editingId === section.id ? '' : 'cursor-grab active:cursor-grabbing'
              } ${
                draggedSectionId === section.id ? 'opacity-50' : ''
              } ${
                dragOverSectionId === section.id ? 'border-t-2 border-[var(--color-interactive-border)]' : ''
              } transition-all`}
            >
              {editingId === section.id ? (
                <>
                  {/* Color picker */}
                  <ColorPicker
                    selectedColor={editingColor}
                    onChange={setEditingColor}
                    colors={SECTION_COLORS}
                    className="grid-cols-4"
                  />
                  
                  {/* Name input */}
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1"
                    autoFocus
                  />
                  
                  {/* Save/Cancel */}
                  <Button onClick={handleSaveEdit} variant="primary" size="sm">
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} variant="secondary" size="sm">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  {/* Color indicator */}
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: section.color || SECTION_COLORS[0] }}
                  />
                  {/* Name */}
                  <span className="flex-1 text-[var(--color-text-primary)] font-medium">
                    {section.name}
                  </span>
                  {/* Edit/Delete buttons (show on hover) */}
                  <button
                    type="button"
                    onClick={() => handleStartEdit(section)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-sm text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSection(section)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add Section Form */}
        {isAdding ? (
          <Panel opacity="subtle" className="p-4 rounded-lg border-2 border-dashed border-[var(--color-interactive-border)]">
            <div className="space-y-3">
              {/* Color picker */}
              <ColorPicker
                selectedColor={newColor}
                onChange={setNewColor}
                colors={SECTION_COLORS}
                className="grid-cols-4"
              />
              
              {/* Name input */}
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSection();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                placeholder="Section name"
                autoFocus
              />
              
              {/* Action buttons */}
              <div className="flex gap-2">
                <Button onClick={handleAddSection} variant="primary" className="flex-1">
                  Add Section
                </Button>
                <Button 
                  onClick={handleCancelAdd} 
                  variant="ghost"
                  className="border border-[var(--color-border-default)]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full px-3 py-2 text-left flex items-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border-default)] text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] hover:border-[var(--color-interactive-border)] font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Section</span>
          </button>
        )}
      </div>
  );

  // Mobile: Use MobileSheet for bottom sheet presentation
  if (isMobile) {
    return (
      <MobileSheet
        isOpen={true}
        onClose={onClose}
        title="Manage Sections"
        maxHeight="85vh"
      >
        <div className="p-4">
          {sectionContent}
        </div>
      </MobileSheet>
    );
  }

  // Desktop: Use Modal
  return (
    <Modal isOpen={true} onClose={onClose} size="lg" title="Manage Sections">
      {sectionContent}
    </Modal>
  );
};

export default SectionManager;
