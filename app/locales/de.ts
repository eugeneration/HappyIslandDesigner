const de = {
    hotkey: 'Tastenkürzel',
    hotkey_tips1: 'Leertaste+Ziehen\n'+
        'Alt+Scrollen\n'+
        '\\\n'+
        'Shift+Ziehen\n'+
        '[ ]\n'+
        'p\n'+
        'Alt+Klick\n'+
        'Entf\n'+
        '{{modifier}} + z\n'+
        '{{modifier}} + y\n'+
        '\n'+
        'b\n'+
        'n\n'+
        'm\n'+
        ',\n'+
        '\n'+
        '{{modifier}} + s\n'+
        '{{modifier}} + o\n'+
        'Esc\n'+
        '?\n'+
        '',
    hotkey_tips2: 'Ansicht verschieben\n'+
        'Zoomen\n'+
        'Raster umschalten\n'+
        'Linie zeichnen\n'+
        'Pinselgröße anpassen\n'+
        'Quadratischer/runder Pinsel\n'+
        'Farbpipette\n'+
        'Auswahl löschen\n'+
        'Rückgängig\n'+
        'Wiederherstellen\n'+
        '\n'+
        'Gelände-Werkzeug\n'+
        'Weg-Werkzeug\n'+
        'Gebäude-Werkzeug\n'+
        'Einrichtungs-Werkzeug\n'+
        '\n'+
        'Speichern\n'+
        'Kartendatei öffnen\n'+
        'Hauptmenü\n'+
        'Tastenkürzel\n'+
        '',
    mainmenu: 'Hauptmenü',
    save_image: 'Als Bild speichern',
    load_map: 'Karte laden',
    new_map: 'Neue Karte',
    clear_warn: 'Karte löschen? Alle nicht gespeicherten Änderungen gehen verloren.',
    tracing_overlay: 'Paus-Overlay',
    import_tracing_overlay: 'Bild für Paus-Overlay importieren',
    import_tracing_overlay_instructions: '1. Laden Sie ein Foto/Screenshot Ihrer Karte hoch\n\n2. Markieren Sie die vier Ecken des Rasters',
    import_tracing_overlay_auto_corners: 'Screenshot erkannt, Ecken werden automatisch positioniert...',
    twitter: 'Twitter',

    // Entry point
    create_new_map: 'Neue Karte erstellen',
    generate_from_screenshot: 'Aus Screenshot generieren',
    tile_editor: 'Kachel-Editor',
    draw_manually: 'Manuell zeichnen',

    // Screenshot flow
    screenshot_title: 'Aus Screenshot generieren',
    screenshot_description: 'Laden Sie einen Screenshot Ihrer Inselkarte hoch, um Ihre Insel automatisch zu generieren.',
    screenshot_upload: 'Screenshot hochladen',
    screenshot_not_detected: 'Bild konnte nicht verarbeitet werden. Bitte laden Sie einen Screenshot der Karte hoch.',
    screenshot_tips_title: 'Screenshot-Tipps',
    screenshot_tips_transfer_heading: 'Von der Switch übertragen:',
    screenshot_tips_capture: 'Drücken Sie die Aufnahmetaste (quadratische Taste am linken Joy-Con), um einen Screenshot zu speichern',
    screenshot_tips_transfer: 'Zum Übertragen: Album → An Smartphone senden, oder per USB oder microSD-Karte auf den PC kopieren',
    screenshot_tips_actual: 'Verwenden Sie den echten In-Game-Screenshot — ein Foto vom Bildschirm funktioniert nicht',
    screenshot_tips_good_heading: 'Einen guten Screenshot machen:',
    screenshot_tips_nookphone: 'Öffnen Sie den NookPhone-Kartenbildschirm vor der Aufnahme',
    screenshot_tips_stand: 'Stehen Sie z.B. am Strand, damit Ihr Spieler-Pin keine Kartendetails verdeckt',
    screenshot_tips_icons: 'Vermeiden Sie es, Symbole auf der Karte auszuwählen — der Generator hat Probleme mit orange hervorgehobenen Symbolen',
    screenshot_tips_overlay: 'Nach der Generierung können Sie das Overlay-Werkzeug zum Vergleichen und Korrigieren verwenden',
    screenshot_flavor_0: 'Insel wird gescannt...',
    screenshot_flavor_1: 'Grenzen werden erkannt...',
    screenshot_flavor_2: 'Gelände wird analysiert...',
    screenshot_flavor_3: 'Randkacheln werden abgeglichen...',
    screenshot_flavor_4: 'Gebäude werden identifiziert...',
    screenshot_flavor_5: 'Gelände wird bearbeitet...',
    screenshot_flavor_6: 'Flüsse werden umgeleitet...',
    screenshot_flavor_7: 'Einrichtungen werden aufgestellt...',
    screenshot_flavor_8: 'Insel wird gebaut...',
    screenshot_flavor_9: 'Bäume werden gepflanzt...',

    // Save tutorial
    save_tutorial_title: 'Hinweise zum Speichern',
    save_tutorial_description: 'Das gespeicherte Bild ist besonders — Ihre Kartendaten sind in den Pixeln kodiert.',
    save_tutorial_warning: 'Kartendaten gehen verloren, wenn Sie das Bild bearbeiten oder komprimieren!',
    save_tutorial_ok: 'Verstanden',

    // Upgrade flow
    cancel: 'Abbrechen',
    upgrade_to_v2: 'Auf V2 upgraden',
    upgrade_description: 'Dies aktualisiert Ihre Karte auf das neue Format. Das neue Format sperrt die Strände und Ränder Ihrer Insel, damit Sie nicht versehentlich darüber zeichnen.',
    upgrade_warning: 'Speichern Sie Ihre Karte vor der Konvertierung — das Ergebnis ist möglicherweise nicht perfekt.',
    upgrade_success: 'Konvertierung erfolgreich!',
    upgrade_failed: 'Konvertierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
    upgrade_convert: 'Konvertieren',
    upgrade_flavor_0: 'Randkacheln werden analysiert...',
    upgrade_flavor_1: 'Küstenlinie wird gescannt...',
    upgrade_flavor_2: 'Flughafen wird gesucht...',
    upgrade_flavor_3: 'Steg wird gesucht...',
    upgrade_flavor_4: 'Halbinsel wird kartiert...',
    upgrade_flavor_5: 'Geheimer Strand wird gesucht...',
    upgrade_flavor_6: 'Felsen werden überprüft...',
    upgrade_flavor_7: 'Geländemuster werden abgeglichen...',
    upgrade_flavor_8: 'Fast fertig...',
    upgrade_flavor_9: 'Konvertierung wird abgeschlossen...',

    // V2 wizard steps
    wizard_river_direction: 'Flussrichtung der Insel wählen',
    wizard_skip: 'Überspringen',
    wizard_choose_terrain: 'Inselgelände wählen',
    wizard_choose_terrain_description: 'Ebnen Sie die Insel ein oder wählen Sie eines der Starter-Layouts.',
    wizard_peninsula_side: 'Seite der Halbinsel wählen',
    wizard_dock_side: 'Steg-Seite?',
    wizard_choose_river_mouth: 'Form der Flussmündung wählen',
    wizard_choose_peninsula_shape: 'Form der Halbinsel wählen',
    wizard_choose_dock_shape: 'Form des Steg-Strandes wählen',
    wizard_choose_secret_beach: 'Form des geheimen Strandes wählen',
    wizard_choose_rock_shape: 'Felsenform wählen',
    wizard_choose_shape: 'Form wählen',

    // Position selectors
    wizard_select_airport: 'Flughafenposition wählen',
    wizard_select_peninsula: 'Position der Halbinsel wählen',
    wizard_select_secret_beach: 'Position des geheimen Strandes wählen',
    wizard_select_left_rock: 'Wo ist der größte Felsen auf der linken Seite?',
    wizard_select_right_rock: 'Wo ist der größte Felsen auf der rechten Seite?',

    // Option selector
    option_swipe_confirm: 'Wischen für Vorschau, tippen zum Bestätigen',
    option_scroll_confirm: 'Scrollen für Vorschau, klicken zum Bestätigen',

    // Position selector prompts
    new_badge: 'NEU',
    beta_badge: 'BETA',
    click_again_confirm: 'Erneut klicken zum Bestätigen',
    tap_again_confirm: 'Erneut tippen zum Bestätigen',
    click_location: 'Einen Ort anklicken',
    tap_location: 'Einen Ort antippen',
    skip_confirm: 'Rest des Ablaufs überspringen?',

    // Legacy flow
    wizard_choose_template: 'Wählen Sie eine Zeichenvorlage!',
    wizard_manual_description: 'Beim manuellen Zeichnen können Sie die gesamte Insel neu zeichnen, aber nicht alles funktioniert im Spiel.',
    wizard_choose_island: 'Wählen Sie Ihre Insel!',
    wizard_choose_island_hint: 'Sie werden wahrscheinlich keine exakte Übereinstimmung finden, aber wählen Sie eine, die Ihrer Insel ungefähr ähnelt.',

    // Settings
    settings: 'Einstellungen',
    settings_language: 'Sprache',
    settings_language_restart: 'Bitte laden Sie die Seite neu, damit die Sprachänderung wirksam wird.',
    translation_disclaimer: 'Die Übersetzungen können Fehler enthalten, ich habe ein Übersetzungstool verwendet.',
};

export default de;
