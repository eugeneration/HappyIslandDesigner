const fr = {
    hotkey: 'Raccourcis clavier',
    hotkey_tips1: 'espace+glisser\n'+
        'alt+molette\n'+
        '\\\n'+
        'shift+glisser\n'+
        '[ ]\n'+
        'p\n'+
        'alt+clic\n'+
        'suppr\n'+
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
        'échap\n'+
        '?\n'+
        '',
    hotkey_tips2: 'déplacer la vue\n'+
        'zoom\n'+
        'afficher/masquer la grille\n'+
        'tracer une ligne\n'+
        'ajuster la taille du pinceau\n'+
        'pinceau carré/rond\n'+
        'pipette\n'+
        'supprimer la sélection\n'+
        'annuler\n'+
        'rétablir\n'+
        '\n'+
        'outil terrain\n'+
        'outil chemin\n'+
        'outil bâtiment\n'+
        'outil équipements\n'+
        '\n'+
        'sauvegarder\n'+
        'ouvrir un fichier carte\n'+
        'menu principal\n'+
        'raccourcis clavier\n'+
        '',
    mainmenu: 'Menu principal',
    save_image: 'Enregistrer en image',
    load_map: 'Charger une carte',
    new_map: 'Nouvelle carte',
    clear_warn: 'Effacer votre carte ? Vous perdrez toutes les modifications non sauvegardées.',
    tracing_overlay: 'Calque de traçage',
    import_tracing_overlay: 'Importer une image pour le calque de traçage',
    import_tracing_overlay_instructions: '1. Téléchargez une photo/capture d\'écran de votre carte\n\n2. Marquez les quatre coins de la grille',
    import_tracing_overlay_auto_corners: 'Capture d\'écran détectée, positionnement automatique des coins...',
    twitter: 'Twitter',

    // Entry point
    create_new_map: 'Créer une nouvelle carte',
    generate_from_screenshot: 'Générer à partir d\'une capture',
    tile_editor: 'Éditeur de tuiles',
    draw_manually: 'Dessiner manuellement',

    // Screenshot flow
    screenshot_title: 'Générer à partir d\'une capture',
    screenshot_description: 'Téléchargez une capture d\'écran de votre carte pour générer automatiquement votre île.',
    screenshot_upload: 'Télécharger la capture',
    screenshot_not_detected: 'Impossible de traiter l\'image. Veuillez télécharger une capture d\'écran de la carte.',
    screenshot_tips_title: 'Conseils pour les captures',
    screenshot_tips_transfer_heading: 'Transférer depuis votre Switch :',
    screenshot_tips_capture: 'Appuyez sur le bouton Capture (bouton carré sur le Joy-Con gauche) pour sauvegarder une capture',
    screenshot_tips_transfer: 'Pour transférer : allez dans Album → Envoyer vers smartphone, ou copiez sur PC via USB ou carte microSD',
    screenshot_tips_actual: 'Utilisez une vraie capture d\'écran du jeu — une photo de l\'écran ne fonctionnera pas',
    screenshot_tips_good_heading: 'Pour une bonne capture :',
    screenshot_tips_nookphone: 'Ouvrez l\'écran carte du NookPhone avant de capturer',
    screenshot_tips_stand: 'Placez-vous sur la plage pour que votre marqueur ne cache pas les détails de la carte',
    screenshot_tips_icons: 'Évitez de sélectionner des icônes sur la carte — le générateur a du mal avec les icônes surlignées en orange',
    screenshot_tips_overlay: 'Après la génération, utilisez l\'outil de calque pour comparer et corriger les erreurs',
    screenshot_flavor_0: 'Scan de l\'île...',
    screenshot_flavor_1: 'Détection des limites...',
    screenshot_flavor_2: 'Analyse du terrain...',
    screenshot_flavor_3: 'Correspondance des tuiles...',
    screenshot_flavor_4: 'Identification des structures...',
    screenshot_flavor_5: 'Creusement du terrain...',
    screenshot_flavor_6: 'Reroutage des rivières...',
    screenshot_flavor_7: 'Installation des équipements...',
    screenshot_flavor_8: 'Construction de l\'île...',
    screenshot_flavor_9: 'Plantation des arbres...',

    // Save tutorial
    save_tutorial_title: 'Notes sur la sauvegarde',
    save_tutorial_description: 'L\'image sauvegardée est spéciale — les données de la carte sont encodées dans les pixels.',
    save_tutorial_warning: 'Les données de la carte seront perdues si vous modifiez ou compressez l\'image !',
    save_tutorial_ok: 'Compris',

    // Upgrade flow
    cancel: 'Annuler',
    upgrade_to_v2: 'Mettre à jour en V2',
    upgrade_description: 'Cela mettra votre carte au nouveau format. Le nouveau format verrouille les plages et les bords de votre île pour éviter de dessiner par-dessus.',
    upgrade_warning: 'Sauvegardez votre carte avant la conversion — le résultat peut ne pas être parfait.',
    upgrade_success: 'Conversion réussie !',
    upgrade_failed: 'La conversion a échoué. Veuillez réessayer.',
    upgrade_convert: 'Convertir',
    upgrade_flavor_0: 'Analyse des tuiles de bord...',
    upgrade_flavor_1: 'Scan du littoral...',
    upgrade_flavor_2: 'Recherche de l\'aéroport...',
    upgrade_flavor_3: 'Recherche du ponton...',
    upgrade_flavor_4: 'Cartographie de la presqu\'île...',
    upgrade_flavor_5: 'Recherche de la plage secrète...',
    upgrade_flavor_6: 'Vérification des rochers...',
    upgrade_flavor_7: 'Correspondance des motifs de terrain...',
    upgrade_flavor_8: 'Presque terminé...',
    upgrade_flavor_9: 'Finalisation de la conversion...',

    // V2 wizard steps
    wizard_river_direction: 'Sélectionnez la direction de la rivière',
    wizard_skip: 'Passer',
    wizard_choose_terrain: 'Choisissez le terrain de l\'île',
    wizard_choose_terrain_description: 'Aplatissez l\'île ou choisissez l\'un des terrains de départ.',
    wizard_peninsula_side: 'Sélectionnez le côté de la presqu\'île',
    wizard_dock_side: 'Côté du ponton ?',
    wizard_choose_river_mouth: 'Choisissez la forme de l\'embouchure',
    wizard_choose_peninsula_shape: 'Choisissez la forme de la presqu\'île',
    wizard_choose_dock_shape: 'Choisissez la forme de la plage du ponton',
    wizard_choose_secret_beach: 'Choisissez la forme de la plage secrète',
    wizard_choose_rock_shape: 'Choisissez la forme du rocher',
    wizard_choose_shape: 'Choisissez la forme',

    // Position selectors
    wizard_select_airport: 'Sélectionnez la position de l\'aéroport',
    wizard_select_peninsula: 'Sélectionnez la position de la presqu\'île',
    wizard_select_secret_beach: 'Sélectionnez la position de la plage secrète',
    wizard_select_left_rock: 'Où se trouve le plus gros rocher à gauche ?',
    wizard_select_right_rock: 'Où se trouve le plus gros rocher à droite ?',

    // Option selector
    option_swipe_confirm: 'Glissez pour prévisualiser, appuyez pour confirmer',
    option_scroll_confirm: 'Défilez pour prévisualiser, cliquez pour confirmer',

    // Position selector prompts
    new_badge: 'NOUVEAU',
    beta_badge: 'BÊTA',
    click_again_confirm: 'Cliquez à nouveau pour confirmer',
    tap_again_confirm: 'Appuyez à nouveau pour confirmer',
    click_location: 'Cliquez sur un emplacement',
    tap_location: 'Appuyez sur un emplacement',
    skip_confirm: 'Passer le reste des étapes ?',

    // Legacy flow
    wizard_choose_template: 'Choisissez un modèle de dessin !',
    wizard_manual_description: 'Le dessin manuel vous permet de redessiner toute l\'île, mais tout ne fonctionnera pas en jeu.',
    wizard_choose_island: 'Choisissez votre île !',

    // Settings
    settings: 'Paramètres',
    settings_language: 'Langue',
    settings_language_restart: 'Veuillez recharger la page pour appliquer le changement de langue.',
};

export default fr;
