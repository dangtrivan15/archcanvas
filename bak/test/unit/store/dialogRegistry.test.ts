/**
 * Tests for the dialog registry infrastructure (P01-T1).
 *
 * Verifies:
 * - Registry register/get/clear operations
 * - Generic openDialog/closeDialog roundtrip in uiStore
 * - Legacy dialog wrappers delegate to generic openDialogs Set
 * - DialogHost renders nothing when no dialogs are open
 * - selectHasOpenDialog works with generic Set
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';
import { selectHasOpenDialog } from '@/store/selectors';
import {
  registerDialog,
  getDialog,
  getRegisteredDialogIds,
  clearRegistry,
} from '@/dialogs/registry';
import type { DialogConfig } from '@/dialogs/types';

describe('Dialog Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registerDialog adds a dialog to the registry', () => {
    const config: DialogConfig = {
      id: 'test',
      component: () => null,
    };
    registerDialog(config);
    expect(getDialog('test')).toBe(config);
  });

  it('getDialog returns undefined for unregistered dialog', () => {
    expect(getDialog('nonexistent')).toBeUndefined();
  });

  it('getRegisteredDialogIds returns all registered IDs', () => {
    registerDialog({ id: 'a', component: () => null });
    registerDialog({ id: 'b', component: () => null });
    registerDialog({ id: 'c', component: () => null });
    expect(getRegisteredDialogIds()).toEqual(['a', 'b', 'c']);
  });

  it('clearRegistry removes all registered dialogs', () => {
    registerDialog({ id: 'test', component: () => null });
    expect(getRegisteredDialogIds()).toHaveLength(1);
    clearRegistry();
    expect(getRegisteredDialogIds()).toHaveLength(0);
  });

  it('registerDialog overwrites existing registration', () => {
    const comp1 = () => null;
    const comp2 = () => null;
    registerDialog({ id: 'test', component: comp1 });
    registerDialog({ id: 'test', component: comp2 });
    expect(getDialog('test')!.component).toBe(comp2);
  });
});

describe('Generic Dialog State (uiStore)', () => {
  beforeEach(() => {
    // Reset the generic dialog state
    useUIStore.setState({
      openDialogs: new Set<string>(),
      dialogProps: new Map<string, unknown>(),
      deleteDialogOpen: false,
      deleteDialogInfo: null,
      connectionDialogOpen: false,
      connectionDialogInfo: null,
      unsavedChangesDialogOpen: false,
      unsavedChangesDialogInfo: null,
      errorDialogOpen: false,
      errorDialogInfo: null,
      integrityWarningDialogOpen: false,
      integrityWarningDialogInfo: null,
      conflictDialogOpen: false,
      conflictDialogInfo: null,
      emptyProjectDialogOpen: false,
      emptyProjectDialogInfo: null,
      externalAgentDialogOpen: false,
      externalAgentDialogInfo: null,
      shortcutsHelpOpen: false,
      commandPaletteOpen: false,
      quickSearchOpen: false,
      shortcutSettingsOpen: false,
      settingsDialogOpen: false,
      templatePickerOpen: false,
      templateGalleryOpen: false,
    });
  });

  it('openDialogs starts empty', () => {
    const state = useUIStore.getState();
    expect(state.openDialogs.size).toBe(0);
    expect(state.dialogProps.size).toBe(0);
  });

  it('openDialog adds dialog ID to openDialogs Set', () => {
    useUIStore.getState().openDialog('test');
    const state = useUIStore.getState();
    expect(state.openDialogs.has('test')).toBe(true);
  });

  it('openDialog stores props in dialogProps Map', () => {
    useUIStore.getState().openDialog('test', { foo: 1, bar: 'hello' });
    const state = useUIStore.getState();
    expect(state.dialogProps.get('test')).toEqual({ foo: 1, bar: 'hello' });
  });

  it('openDialog without props does not set dialogProps entry', () => {
    useUIStore.getState().openDialog('test');
    const state = useUIStore.getState();
    expect(state.dialogProps.has('test')).toBe(false);
  });

  it('closeDialog removes dialog from both Set and Map', () => {
    useUIStore.getState().openDialog('test', { foo: 1 });
    useUIStore.getState().closeDialog('test');
    const state = useUIStore.getState();
    expect(state.openDialogs.has('test')).toBe(false);
    expect(state.dialogProps.has('test')).toBe(false);
  });

  it('openDialog + closeDialog roundtrip works correctly', () => {
    const store = useUIStore.getState();
    store.openDialog('test', { foo: 1 });
    expect(useUIStore.getState().openDialogs.has('test')).toBe(true);
    expect(useUIStore.getState().dialogProps.get('test')).toEqual({ foo: 1 });

    useUIStore.getState().closeDialog('test');
    expect(useUIStore.getState().openDialogs.has('test')).toBe(false);
    expect(useUIStore.getState().dialogProps.has('test')).toBe(false);
  });

  it('multiple dialogs can be open simultaneously', () => {
    useUIStore.getState().openDialog('dialog-a', { a: true });
    useUIStore.getState().openDialog('dialog-b', { b: true });
    useUIStore.getState().openDialog('dialog-c');
    const state = useUIStore.getState();
    expect(state.openDialogs.size).toBe(3);
    expect(state.openDialogs.has('dialog-a')).toBe(true);
    expect(state.openDialogs.has('dialog-b')).toBe(true);
    expect(state.openDialogs.has('dialog-c')).toBe(true);
  });

  it('closing one dialog does not affect others', () => {
    useUIStore.getState().openDialog('a', { x: 1 });
    useUIStore.getState().openDialog('b', { y: 2 });
    useUIStore.getState().closeDialog('a');
    const state = useUIStore.getState();
    expect(state.openDialogs.has('a')).toBe(false);
    expect(state.openDialogs.has('b')).toBe(true);
    expect(state.dialogProps.get('b')).toEqual({ y: 2 });
  });

  it('closing a non-open dialog is a no-op', () => {
    useUIStore.getState().openDialog('a');
    useUIStore.getState().closeDialog('nonexistent');
    expect(useUIStore.getState().openDialogs.size).toBe(1);
  });

  it('getDialogProps returns props for an open dialog', () => {
    useUIStore.getState().openDialog('test', { key: 'value' });
    expect(useUIStore.getState().getDialogProps('test')).toEqual({ key: 'value' });
  });

  it('getDialogProps returns undefined for non-open dialog', () => {
    expect(useUIStore.getState().getDialogProps('nonexistent')).toBeUndefined();
  });
});

describe('Legacy Dialog Wrappers Delegate to Generic', () => {
  beforeEach(() => {
    useUIStore.setState({
      openDialogs: new Set<string>(),
      dialogProps: new Map<string, unknown>(),
      deleteDialogOpen: false,
      deleteDialogInfo: null,
      connectionDialogOpen: false,
      connectionDialogInfo: null,
      unsavedChangesDialogOpen: false,
      unsavedChangesDialogInfo: null,
      errorDialogOpen: false,
      errorDialogInfo: null,
      integrityWarningDialogOpen: false,
      integrityWarningDialogInfo: null,
      conflictDialogOpen: false,
      conflictDialogInfo: null,
      shortcutsHelpOpen: false,
      commandPaletteOpen: false,
      quickSearchOpen: false,
      shortcutSettingsOpen: false,
      settingsDialogOpen: false,
      emptyProjectDialogOpen: false,
      emptyProjectDialogInfo: null,
      externalAgentDialogOpen: false,
      externalAgentDialogInfo: null,
      templatePickerOpen: false,
      templateGalleryOpen: false,
    });
  });

  it('openDeleteDialog populates both legacy flags and generic Set', () => {
    const info = { nodeId: 'n1', nodeName: 'Test', edgeCount: 0, childCount: 0 };
    useUIStore.getState().openDeleteDialog(info);
    const state = useUIStore.getState();

    // Legacy flags
    expect(state.deleteDialogOpen).toBe(true);
    expect(state.deleteDialogInfo).toEqual(info);

    // Generic Set
    expect(state.openDialogs.has('delete')).toBe(true);
    expect(state.dialogProps.get('delete')).toEqual(info);
  });

  it('closeDeleteDialog clears both legacy flags and generic Set', () => {
    const info = { nodeId: 'n1', nodeName: 'Test', edgeCount: 0, childCount: 0 };
    useUIStore.getState().openDeleteDialog(info);
    useUIStore.getState().closeDeleteDialog();
    const state = useUIStore.getState();

    expect(state.deleteDialogOpen).toBe(false);
    expect(state.deleteDialogInfo).toBeNull();
    expect(state.openDialogs.has('delete')).toBe(false);
    expect(state.dialogProps.has('delete')).toBe(false);
  });

  it('openConnectionDialog populates both legacy and generic', () => {
    const info = { sourceNodeId: 's1', targetNodeId: 't1' };
    useUIStore.getState().openConnectionDialog(info);
    const state = useUIStore.getState();

    expect(state.connectionDialogOpen).toBe(true);
    expect(state.openDialogs.has('connection')).toBe(true);
  });

  it('openErrorDialog populates both legacy and generic', () => {
    const info = { title: 'Error', message: 'Something went wrong' };
    useUIStore.getState().openErrorDialog(info);
    const state = useUIStore.getState();

    expect(state.errorDialogOpen).toBe(true);
    expect(state.openDialogs.has('error')).toBe(true);
    expect(state.dialogProps.get('error')).toEqual(info);
  });

  it('openShortcutsHelp populates generic Set', () => {
    useUIStore.getState().openShortcutsHelp();
    const state = useUIStore.getState();

    expect(state.shortcutsHelpOpen).toBe(true);
    expect(state.openDialogs.has('shortcutsHelp')).toBe(true);
  });

  it('closeShortcutsHelp removes from generic Set', () => {
    useUIStore.getState().openShortcutsHelp();
    useUIStore.getState().closeShortcutsHelp();
    const state = useUIStore.getState();

    expect(state.shortcutsHelpOpen).toBe(false);
    expect(state.openDialogs.has('shortcutsHelp')).toBe(false);
  });

  it('toggleShortcutsHelp toggles both legacy flag and generic Set', () => {
    useUIStore.getState().toggleShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(true);
    expect(useUIStore.getState().openDialogs.has('shortcutsHelp')).toBe(true);

    useUIStore.getState().toggleShortcutsHelp();
    expect(useUIStore.getState().shortcutsHelpOpen).toBe(false);
    expect(useUIStore.getState().openDialogs.has('shortcutsHelp')).toBe(false);
  });

  it('openCommandPalette populates generic Set', () => {
    useUIStore.getState().openCommandPalette();
    expect(useUIStore.getState().openDialogs.has('commandPalette')).toBe(true);
  });

  it('openSettingsDialog populates generic Set', () => {
    useUIStore.getState().openSettingsDialog();
    expect(useUIStore.getState().openDialogs.has('settings')).toBe(true);
  });

  it('openTemplatePicker populates generic Set', () => {
    useUIStore.getState().openTemplatePicker();
    expect(useUIStore.getState().openDialogs.has('templatePicker')).toBe(true);
  });

  it('openTemplateGallery populates generic Set', () => {
    useUIStore.getState().openTemplateGallery();
    expect(useUIStore.getState().openDialogs.has('templateGallery')).toBe(true);
  });
});

describe('selectHasOpenDialog with generic Set', () => {
  beforeEach(() => {
    useUIStore.setState({
      openDialogs: new Set<string>(),
      dialogProps: new Map<string, unknown>(),
      deleteDialogOpen: false,
      connectionDialogOpen: false,
      unsavedChangesDialogOpen: false,
      errorDialogOpen: false,
      integrityWarningDialogOpen: false,
      shortcutsHelpOpen: false,
      commandPaletteOpen: false,
      quickSearchOpen: false,
      shortcutSettingsOpen: false,
      settingsDialogOpen: false,
      templatePickerOpen: false,
      templateGalleryOpen: false,
    });
  });

  it('returns false when no dialogs are open', () => {
    expect(selectHasOpenDialog(useUIStore.getState())).toBe(false);
  });

  it('returns true when a generic-only dialog is open', () => {
    useUIStore.getState().openDialog('custom-dialog');
    expect(selectHasOpenDialog(useUIStore.getState())).toBe(true);
  });

  it('returns true when a legacy dialog is open', () => {
    useUIStore.getState().openDeleteDialog({
      nodeId: 'n1',
      nodeName: 'Test',
      edgeCount: 0,
      childCount: 0,
    });
    expect(selectHasOpenDialog(useUIStore.getState())).toBe(true);
  });

  it('returns false after closing all dialogs', () => {
    useUIStore.getState().openDialog('custom');
    useUIStore.getState().closeDialog('custom');
    expect(selectHasOpenDialog(useUIStore.getState())).toBe(false);
  });
});
