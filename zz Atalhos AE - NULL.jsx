#target aftereffects
#targetengine "atalhos_ae_engine"

/* Assign N to this native File > Scripts command in AE's Keyboard Shortcuts.
 * The zz prefix appends it after existing scripts, preserving their slots.
 * No panel focus, polling, global keyboard hook or extra window is required.
 */
(function runNullShortcut() {
    var helper = File(File($.fileName).parent.fsName + "/Atalhos AE-assets/null-action.jsxinc");
    if (!helper.exists) {
        alert("Reinstale o Atalhos AE: o arquivo null-action.jsxinc nao foi encontrado ao lado do script.", "Atalhos AE");
        return;
    }
    $.evalFile(helper);
    $.global.__ATALHOS_AE_NULL_ACTION__.run();
}());
