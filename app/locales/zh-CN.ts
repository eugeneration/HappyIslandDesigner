const zhCN = {
    hotkey: '快捷键',
    hotkey_tips1: '空格 + 拖拽\n'+
        'alt + 滚轮\n'+
        '\\\n'+
        'shift + 拖拽\n'+
        '[ ]\n'+
        'p\n'+
        'alt + 单击\n'+
        'delete\n'+
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
    hotkey_tips2: '拖动\n'+
        '放大缩小\n'+
        '打开/关闭网格\n'+
        '画线\n'+
        '调整笔刷尺寸\n'+
        '方形/圆形笔刷\n'+
        '颜色选择器\n'+
        '删除被选中的内容\n'+
        '撤销\n'+
        '重做\n'+
        '\n'+
        '地形工具 \n'+
        '路径工具\n'+
        '建筑物工具\n'+
        '便利设施工具\n'+
        '\n'+
        '保存\n'+
        '打开地图文件\n'+
        '主菜单\n'+
        '快捷键\n'+
        '',
    mainmenu: '主菜单',
    save_image: '保存成图片',
    load_map: '载入地图',
    new_map: '创建新的地图',
    clear_warn: '确定要清除地图吗？您未保存的内容将全部丢失',
    tracing_overlay: '描图覆盖层',
    import_tracing_overlay: '导入描图图片',
    import_tracing_overlay_instructions: '1. 上传地图的照片或屏幕截图\n\n2. 标记网格的四个角',
    import_tracing_overlay_auto_corners: '检测到截图，正在自动定位角点...',
    twitter: '推特',

    // Entry point
    create_new_map: '创建新地图',
    generate_from_screenshot: '从截图生成',
    tile_editor: '地块编辑器',
    draw_manually: '手动绘制',

    // Screenshot flow
    screenshot_title: '从截图生成',
    screenshot_description: '上传岛屿地图的截图，自动生成你的岛屿。',
    screenshot_upload: '上传截图',
    screenshot_not_detected: '无法处理图片。请上传地图的截图。',
    screenshot_tips_title: '截图小贴士',
    screenshot_tips_transfer_heading: '从Switch传输截图：',
    screenshot_tips_capture: '按下截图键（左Joy-Con上的方形按钮）保存截图',
    screenshot_tips_transfer: '传输方法：进入相册 → 发送到智能手机，或通过USB或microSD卡复制到电脑',
    screenshot_tips_actual: '请使用游戏内截图——拍摄屏幕的照片无法识别',
    screenshot_tips_good_heading: '如何拍好截图：',
    screenshot_tips_nookphone: '截图前请先打开狸克手机的地图界面',
    screenshot_tips_stand: '站在沙滩等位置，避免玩家图标遮挡地图细节',
    screenshot_tips_icons: '不要选中地图上的图标——生成器无法识别橙色高亮图标',
    screenshot_tips_overlay: '生成后，可以使用描图覆盖层工具对比并修正错误',
    screenshot_flavor_0: '正在扫描岛屿...',
    screenshot_flavor_1: '正在检测边界...',
    screenshot_flavor_2: '正在分析地形...',
    screenshot_flavor_3: '正在匹配边缘地块...',
    screenshot_flavor_4: '正在识别建筑...',
    screenshot_flavor_5: '正在挖掘地形...',
    screenshot_flavor_6: '正在改造河流...',
    screenshot_flavor_7: '正在布置设施...',
    screenshot_flavor_8: '正在建设岛屿...',
    screenshot_flavor_9: '正在种植树木...',

    // Upgrade flow
    cancel: '取消',
    upgrade_to_v2: '升级到V2',
    upgrade_description: '这将把你的地图升级到新格式。新格式会锁定岛屿的沙滩和边缘，这样你就不用担心画到边界外面了。',
    upgrade_warning: '转换前请先保存地图——转换结果可能不完美。',
    upgrade_success: '转换成功！',
    upgrade_failed: '转换失败，请重试。',
    upgrade_convert: '转换',
    upgrade_flavor_0: '正在分析边缘地块...',
    upgrade_flavor_1: '正在扫描海岸线...',
    upgrade_flavor_2: '正在寻找机场...',
    upgrade_flavor_3: '正在搜索码头...',
    upgrade_flavor_4: '正在绘制半岛...',
    upgrade_flavor_5: '正在寻找秘密沙滩...',
    upgrade_flavor_6: '正在检查岩石...',
    upgrade_flavor_7: '正在匹配地形...',
    upgrade_flavor_8: '即将完成...',
    upgrade_flavor_9: '正在完成转换...',

    // V2 wizard steps
    wizard_river_direction: '选择岛屿河流方向',
    wizard_skip: '跳过',
    wizard_choose_terrain: '选择岛屿地形',
    wizard_choose_terrain_description: '选择平坦地形或初始岛屿布局。',
    wizard_peninsula_side: '选择半岛方向',
    wizard_dock_side: '码头在哪一侧？',
    wizard_choose_river_mouth: '选择河口形状',
    wizard_choose_peninsula_shape: '选择半岛形状',
    wizard_choose_dock_shape: '选择码头沙滩形状',
    wizard_choose_secret_beach: '选择秘密沙滩形状',
    wizard_choose_rock_shape: '选择岩石形状',
    wizard_choose_shape: '选择形状',

    // Position selectors
    wizard_select_airport: '选择机场位置',
    wizard_select_peninsula: '选择半岛位置',
    wizard_select_secret_beach: '选择秘密沙滩位置',
    wizard_select_left_rock: '左侧的大岩石在哪里？',
    wizard_select_right_rock: '右侧的大岩石在哪里？',

    // Option selector
    option_swipe_confirm: '滑动预览，点击确认',
    option_scroll_confirm: '滚动预览，点击确认',

    // Position selector prompts
    new_badge: 'NEW',
    beta_badge: '测试版',
    click_again_confirm: '再次点击确认',
    tap_again_confirm: '再次点击确认',
    click_location: '点击一个位置',
    tap_location: '点击一个位置',
    skip_confirm: '跳过剩余步骤？',

    // Legacy flow
    wizard_choose_template: '选择绘图模板！',
    wizard_manual_description: '手动绘制可以重新绘制整个岛屿，但部分内容可能无法在游戏中实现。',
    wizard_choose_island: '选择你的岛屿！',
};

export default zhCN;
