const esES = {
    hotkey: 'Atajos de teclado',
    hotkey_tips1: 'esp+arrastrar\n'+
        'alt+scroll\n'+
        '\\\n'+
        'shift+arrastrar\n'+
        '[ ]\n'+
        'p\n'+
        'alt+click\n'+
        'supr\n'+
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
        'esc\n'+
        '?\n'+
        '',
    hotkey_tips2: 'mover el mapa\n'+
        'hacer zoom\n'+
        'mostrar/ocultar la rejilla\n'+
        'dibujar una línea recta\n'+
        'ajustar tamaño del pincel\n'+
        'pincel cuadrado/circular\n'+
        'clonar color\n'+
        'borrar la selección\n'+
        'deshacer\n'+
        'rehacer\n'+
        '\n'+
        'herramienta de terreno\n'+
        'herramienta de caminos\n'+
        'herramienta de casas\n'+
        'herramienta de instalaciones\n'+
        '\n'+
        'guardar\n'+
        'abrir un archivo de mapa\n'+
        'menú principal\n'+
        'atajos de teclado\n'+
        '',
    mainmenu: 'Menú Principal',
    save_image: 'Guardar como Imagen',
    load_map: 'Cargar Mapa',
    new_map: 'Nuevo Mapa',
    clear_warn: '¿Vaciar el mapa? Perderás todos los cambios no guardados.',
    tracing_overlay: 'Capa de Trazado',
    import_tracing_overlay: 'Importar Imagen para Trazado',
    import_tracing_overlay_instructions: '1. Sube una foto o captura de pantalla de tu mapa\n\n2. Marca las cuatro esquinas de la rejilla',
    import_tracing_overlay_auto_corners: 'Captura detectada, posicionando esquinas automáticamente...',
    twitter: 'Twitter',

    // Entry point
    create_new_map: 'Crear Nuevo Mapa',
    generate_from_screenshot: 'Generar desde Captura',
    tile_editor: 'Editor de Casillas',
    draw_manually: 'Dibujar Manualmente',

    // Screenshot flow
    screenshot_title: 'Generar desde Captura',
    screenshot_description: 'Sube una captura de pantalla de tu mapa de isla para generar tu isla automáticamente.',
    screenshot_upload: 'Subir Captura',
    screenshot_not_detected: 'No se pudo procesar la imagen. Por favor, sube una captura de pantalla del mapa.',
    screenshot_tips_title: 'Consejos para Capturas',
    screenshot_tips_transfer_heading: 'Transferir desde tu Switch:',
    screenshot_tips_capture: 'Pulsa el botón de captura (botón cuadrado en el Joy-Con izquierdo) para guardar una captura',
    screenshot_tips_transfer: 'Para transferir: ve a Álbum → Enviar a smartphone, o copia a PC mediante USB o tarjeta microSD',
    screenshot_tips_actual: 'Usa la captura de pantalla del juego — una foto de la pantalla no funcionará',
    screenshot_tips_good_heading: 'Cómo tomar una buena captura:',
    screenshot_tips_nookphone: 'Abre la pantalla del mapa en tu NookPhone antes de capturar',
    screenshot_tips_stand: 'Quédate en un lugar como la playa para que tu icono de jugador no tape detalles del mapa',
    screenshot_tips_icons: 'No selecciones iconos en el mapa — el generador tiene problemas con los iconos resaltados en naranja',
    screenshot_tips_overlay: 'Después de generar, usa la herramienta de trazado para comparar y corregir errores',
    screenshot_flavor_0: 'Escaneando isla...',
    screenshot_flavor_1: 'Detectando límites...',
    screenshot_flavor_2: 'Analizando terreno...',
    screenshot_flavor_3: 'Identificando casillas de borde...',
    screenshot_flavor_4: 'Identificando estructuras...',
    screenshot_flavor_5: 'Excavando terreno...',
    screenshot_flavor_6: 'Redirigiendo ríos...',
    screenshot_flavor_7: 'Colocando edificios...',
    screenshot_flavor_8: 'Construyendo isla...',
    screenshot_flavor_9: 'Plantando árboles...',

    // Save tutorial
    save_tutorial_title: 'Notas sobre el guardado',
    save_tutorial_description: 'Esta imagen guardada es especial \u2014 los datos de tu mapa están codificados en los píxeles.',
    save_tutorial_warning: '¡Los datos del mapa se perderán si editas o comprimes la imagen!',
    save_tutorial_ok: 'Entendido',

    // Upgrade flow
    cancel: 'Cancelar',
    upgrade_to_v2: 'Actualizar a V2',
    upgrade_description: 'Esto actualizará tu mapa al nuevo formato. El nuevo formato bloquea las playas y los bordes de tu isla para que no tengas que preocuparte por dibujar encima.',
    upgrade_warning: 'Guarda tu mapa antes de convertir — la conversión podría no producir resultados perfectos.',
    upgrade_success: '¡Conversión exitosa!',
    upgrade_failed: 'La conversión falló. Por favor, inténtalo de nuevo.',
    upgrade_convert: 'Convertir',
    upgrade_flavor_0: 'Analizando casillas de borde...',
    upgrade_flavor_1: 'Escaneando la costa...',
    upgrade_flavor_2: 'Buscando el aeropuerto...',
    upgrade_flavor_3: 'Buscando el embarcadero...',
    upgrade_flavor_4: 'Mapeando la península...',
    upgrade_flavor_5: 'Encontrando la playa secreta...',
    upgrade_flavor_6: 'Revisando las rocas...',
    upgrade_flavor_7: 'Comparando patrones de terreno...',
    upgrade_flavor_8: 'Casi listo...',
    upgrade_flavor_9: 'Finalizando la conversión...',

    // V2 wizard steps
    wizard_river_direction: 'Selecciona la Dirección del Río',
    wizard_skip: 'Omitir',
    wizard_choose_terrain: 'Elige el Terreno de la Isla',
    wizard_choose_terrain_description: 'Aplana la isla o elige uno de los diseños iniciales.',
    wizard_peninsula_side: 'Selecciona el Lado de la Península',
    wizard_dock_side: '¿Lado del Embarcadero?',
    wizard_choose_river_mouth: 'Elige la Forma de la Desembocadura',
    wizard_choose_peninsula_shape: 'Elige la Forma de la Península',
    wizard_choose_dock_shape: 'Elige la Forma de la Playa del Embarcadero',
    wizard_choose_secret_beach: 'Elige la Forma de la Playa Secreta',
    wizard_choose_rock_shape: 'Elige la Forma de la Roca',
    wizard_choose_shape: 'Elige la Forma',

    // Position selectors
    wizard_select_airport: 'Selecciona la Posición del Aeropuerto',
    wizard_select_peninsula: 'Selecciona la Posición de la Península',
    wizard_select_secret_beach: 'Selecciona la Posición de la Playa Secreta',
    wizard_select_left_rock: '¿Dónde está la Roca Grande del Lado Izquierdo?',
    wizard_select_right_rock: '¿Dónde está la Roca Grande del Lado Derecho?',

    // Option selector
    option_swipe_confirm: 'Desliza para previsualizar, toca para confirmar',
    option_scroll_confirm: 'Desplaza para previsualizar, haz clic para confirmar',

    // Position selector prompts
    new_badge: 'NEW',
    beta_badge: 'BETA',
    click_again_confirm: 'Haz clic de nuevo para confirmar',
    tap_again_confirm: 'Toca de nuevo para confirmar',
    click_location: 'Haz clic en una ubicación',
    tap_location: 'Toca una ubicación',
    skip_confirm: '¿Omitir el resto del proceso?',

    // Legacy flow
    wizard_choose_template: '¡Elige una Plantilla de Dibujo!',
    wizard_manual_description: 'El dibujo manual te permite redibujar toda la isla, pero no todo funcionará en el juego.',
    wizard_choose_island: '¡Elige tu Isla!',
};

export default esES;
