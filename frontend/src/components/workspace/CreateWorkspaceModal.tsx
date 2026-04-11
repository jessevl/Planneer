/**
 * @file CreateWorkspaceModal.tsx
 * @description Modal dialog for creating a new workspace
 * @app SHARED - Workspace management
 * 
 * Uses AddTaskForm-style split panel layout:
 * - Left side: Live preview with name/description inputs
 * - Right side: Panel with color picker
 * 
 * Features:
 * - Name input (required)
 * - Description input (optional)
 * - Color picker for workspace branding
 * - Create button with loading state
 * - Glass/glow button effects
 */
import React, { useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Modal, Input, Button, Panel, MobileSheet, ModalFooter, PropertyRow } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/design-system';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WORKSPACE_COLORS = [
  { color: '#3b82f6', name: 'Blue' },
  { color: '#10b981', name: 'Green' },
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#f59e0b', name: 'Amber' },
  { color: '#ef4444', name: 'Red' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#84cc16', name: 'Lime' },
  { color: '#f97316', name: 'Orange' },
  { color: '#6366f1', name: 'Indigo' },
];

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose }) => {
  const isMobile = useIsMobile();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(WORKSPACE_COLORS[0].color);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);

  // Get selected color name for display
  const selectedColorName = WORKSPACE_COLORS.find(c => c.color === color)?.name || 'Custom';

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const workspace = await createWorkspace(trimmedName, description.trim() || undefined);
      
      // Update workspace color (if different from default)
      if (color !== WORKSPACE_COLORS[0].color) {
        await useWorkspaceStore.getState().updateWorkspace(workspace.id, { color });
      }
      
      // Switch to the new workspace
      setCurrentWorkspace(workspace.id);
      
      // Reset form and close
      setName('');
      setDescription('');
      setColor(WORKSPACE_COLORS[0].color);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, color, createWorkspace, setCurrentWorkspace, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setColor(WORKSPACE_COLORS[0].color);
    setError(null);
    onClose();
  }, [onClose]);

  // Form actions with glass/glow styling (matches AddTaskForm)
  const formActions = (
    <ModalFooter
      onCancel={handleClose}
      onSubmit={() => {}} // Handled by form onSubmit
      submitLabel={isSubmitting ? 'Creating...' : 'Create Workspace'}
      submitDisabled={isSubmitting || !name.trim()}
      formId="create-workspace-form"
    />
  );

  // Mobile: Uses flat form layout with MobileSheet for color picker
  if (isMobile) {
    return (
      <MobileSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Create Workspace"
        maxHeight="90vh"
      >
        <div className="p-4">
          <form id="create-workspace-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Preview + Name */}
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold transition-colors flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {name.trim().charAt(0).toUpperCase() || 'W'}
              </div>
              <div className="flex-1">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Workspace name..."
                  autoFocus
                  maxLength={50}
                  className="text-lg font-semibold border-0 bg-transparent px-0 focus:ring-0 placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this workspace for?"
                maxLength={200}
                className="w-full text-sm"
              />
            </div>

            {/* Properties Section */}
            <div className="w-auto -mx-4 px-4 py-4 border-t border-[var(--color-border-subtle)] mt-4">
              <div className="px-1 mb-3 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Properties</div>
              
              <div className="relative">
                <PropertyRow
                  label="Color"
                  icon={
                    <div
                      className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  }
                  value={selectedColorName}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  active={showColorPicker}
                />
                {showColorPicker && (
                  <MobileSheet isOpen={showColorPicker} onClose={() => setShowColorPicker(false)} title="Select Color">
                    <div className="p-4 grid grid-cols-5 gap-3">
                      {WORKSPACE_COLORS.map(({ color: c, name: n }) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setColor(c); setShowColorPicker(false); }}
                          className={cn(
                            "w-12 h-12 rounded-xl transition-all",
                            color === c && "ring-2 ring-offset-2 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]"
                          )}
                          style={{ backgroundColor: c }}
                          title={n}
                        >
                          {color === c && (
                            <svg className="w-6 h-6 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </MobileSheet>
                )}
              </div>
            </div>

            {formActions}
          </form>
        </div>
      </MobileSheet>
    );
  }

  // Desktop: Split panel layout (like AddTaskForm)
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Workspace"
      size="2xl"
      footer={formActions}
    >
      <form id="create-workspace-form" onSubmit={handleSubmit}>
        <div className="flex flex-row gap-0 items-stretch min-h-[280px]">
          {/* Left Column: Preview + Name/Description */}
          <div className="w-1/2 flex flex-col py-4 pr-4 pl-0">
            <div className="flex-1">
              {/* Error message */}
              {error && (
                <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Large Preview */}
              <div className="flex flex-col items-center justify-center mb-6 pt-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold transition-colors shadow-lg"
                  style={{ backgroundColor: color }}
                >
                  {name.trim().charAt(0).toUpperCase() || 'W'}
                </div>
              </div>

              {/* Name Input */}
              <div className="mb-4">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                  placeholder="Workspace name..."
                  autoFocus
                  maxLength={50}
                  className="text-xl font-bold text-center border-0 bg-transparent focus:ring-0 focus:border-0 placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>

              {/* Description Input */}
              <div className="text-center">
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this workspace for?"
                  maxLength={200}
                  className="text-sm text-center border-0 bg-transparent focus:ring-0 focus:border-0 placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Properties (Panel) */}
          <Panel 
            padding="none" 
            shadow="sm"
            className="w-1/2 border-l border-[var(--color-border-subtle)] rounded-2xl bg-[var(--color-surface-base)] dark:bg-[var(--color-surface-inset)]"
          >
            <div className="space-y-1 h-full p-4">
              <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Properties</div>
              
              {/* Color Selection */}
              <div className="mt-3">
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  Color
                </div>
                <div className="grid grid-cols-5 gap-2 px-2">
                  {WORKSPACE_COLORS.map(({ color: c, name: n }) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all hover:scale-110",
                        color === c && "ring-2 ring-offset-2 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]"
                      )}
                      style={{ backgroundColor: c }}
                      title={n}
                    >
                      {color === c && (
                        <svg className="w-4 h-4 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </form>
    </Modal>
  );
};

export default CreateWorkspaceModal;
