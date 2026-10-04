/* EBLANKRAFT BLOCKLY — готові приклади (XML робочих полів) */
window.EBLAN_EXAMPLES = {

nuke: '<xml xmlns="https://developers.google.com/blockly/xml">' +
'<block type="eblan_mod" x="20" y="20"><field name="ID">blocky_nuke</field>' +
'<field name="NAME">💣 Блоковий Нюк</field><field name="AUTHOR">Blockly</field>' +
'<field name="VERSION">1.0</field><statement name="ONENABLE">' +
'<block type="eblan_toast"><value name="TEXT"><block type="text">' +
'<field name="TEXT">💣 Нюк готовий! Напиши /nuke</field></block></value>' +
'<next><block type="eblan_command"><field name="CMD">/nuke</field>' +
'<statement name="DO">' +
'<block type="eblan_pos_vars">' +
'<next><block type="controls_repeat_ext">' +
'<value name="TIMES"><block type="math_number"><field name="NUM">8</field></block></value>' +
'<statement name="DO">' +
'<block type="eblan_tnt">' +
'<value name="X"><block type="variables_get"><field name="VAR">px</field></block></value>' +
'<value name="Y"><block type="math_arithmetic"><field name="OP">ADD</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">py</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">2.5</field></block></value>' +
'</block></value>' +
'<value name="Z"><block type="variables_get"><field name="VAR">pz</field></block></value>' +
'<value name="VX"><block type="math_number"><field name="NUM">0</field></block></value>' +
'<value name="VY"><block type="math_number"><field name="NUM">9</field></block></value>' +
'<value name="VZ"><block type="math_number"><field name="NUM">0</field></block></value>' +
'</block></statement></block></next></block>' +
'</statement></block></next></block>' +
'</statement></block></xml>',

kit: '<xml xmlns="https://developers.google.com/blockly/xml">' +
'<block type="eblan_mod" x="20" y="20"><field name="ID">blocky_kit</field>' +
'<field name="NAME">🎒 Блоковий Кіт</field><field name="AUTHOR">Blockly</field>' +
'<field name="VERSION">1.0</field><statement name="ONENABLE">' +
'<block type="eblan_command"><field name="CMD">/kit</field>' +
'<statement name="DO">' +
'<block type="eblan_give"><field name="ITEM">stone</field>' +
'<value name="COUNT"><block type="math_number"><field name="NUM">32</field></block></value>' +
'<next><block type="eblan_give"><field name="ITEM">apple</field>' +
'<value name="COUNT"><block type="math_number"><field name="NUM">5</field></block></value>' +
'<next><block type="eblan_heal">' +
'<value name="V"><block type="math_number"><field name="NUM">50</field></block></value>' +
'<next><block type="eblan_toast"><value name="TEXT"><block type="text">' +
'<field name="TEXT">🎒 Набір видано!</field></block></value></block>' +
'</next></block></next></block></next></block>' +
'</statement></block>' +
'</statement></block></xml>',

platform: '<xml xmlns="https://developers.google.com/blockly/xml">' +
'<block type="eblan_mod" x="20" y="20"><field name="ID">blocky_platform</field>' +
'<field name="NAME">🔨 Блокова Платформа</field><field name="AUTHOR">Blockly</field>' +
'<field name="VERSION">1.0</field><statement name="ONENABLE">' +
'<block type="eblan_command"><field name="CMD">/platform</field>' +
'<statement name="DO">' +
'<block type="eblan_pos_vars"><next>' +
'<block type="eblan_fill"><field name="B">PLANKS</field>' +
'<value name="X1"><block type="math_arithmetic"><field name="OP">MINUS</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">px</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">3</field></block></value></block></value>' +
'<value name="Y1"><block type="math_arithmetic"><field name="OP">MINUS</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">py</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">1</field></block></value></block></value>' +
'<value name="Z1"><block type="math_arithmetic"><field name="OP">MINUS</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">pz</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">3</field></block></value></block></value>' +
'<value name="X2"><block type="math_arithmetic"><field name="OP">ADD</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">px</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">3</field></block></value></block></value>' +
'<value name="Y2"><block type="math_arithmetic"><field name="OP">MINUS</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">py</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">1</field></block></value></block></value>' +
'<value name="Z2"><block type="math_arithmetic"><field name="OP">ADD</field>' +
'<value name="A"><block type="variables_get"><field name="VAR">pz</field></block></value>' +
'<value name="B"><block type="math_number"><field name="NUM">3</field></block></value></block></value>' +
'</block></next></block>' +
'</statement></block>' +
'</statement></block></xml>',

hud: '<xml xmlns="https://developers.google.com/blockly/xml">' +
'<block type="eblan_mod" x="20" y="20"><field name="ID">blocky_hud</field>' +
'<field name="NAME">🖥 Міні-HUD + Модель</field><field name="AUTHOR">Blockly</field>' +
'<field name="VERSION">1.0</field><statement name="ONENABLE">' +
'<block type="eblan_ui_panel"><field name="ID">hud_panel</field>' +
'<field name="TITLE">🎩 Міні-HUD</field>' +
'<value name="X"><block type="math_number"><field name="NUM">12</field></block></value>' +
'<value name="Y"><block type="math_number"><field name="NUM">12</field></block></value>' +
'<value name="W"><block type="math_number"><field name="NUM">220</field></block></value>' +
'<value name="H"><block type="math_number"><field name="NUM">130</field></block></value>' +
'<statement name="DO">' +
'<block type="eblan_ui_label"><field name="ID">hud_sub</field>' +
'<value name="TEXT"><block type="text"><field name="TEXT">Підзаголовок HUD</field></block></value>' +
'<value name="SIZE"><block type="math_number"><field name="NUM">15</field></block></value>' +
'<value name="X"><block type="math_number"><field name="NUM">30</field></block></value>' +
'<value name="Y"><block type="math_number"><field name="NUM">40</field></block></value>' +
'<next><block type="eblan_ui_button"><field name="ID">hud_btn</field>' +
'<value name="TEXT"><block type="text"><field name="TEXT">🎉 Тисни</field></block></value>' +
'<value name="X"><block type="math_number"><field name="NUM">30</field></block></value>' +
'<value name="Y"><block type="math_number"><field name="NUM">85</field></block></value>' +
'<statement name="CLICK"><block type="eblan_toast">' +
'<value name="TEXT"><block type="text"><field name="TEXT">Клік работает!</field></block></value>' +
'</block></statement></block></next></block>' +
'</statement>' +
'<next><block type="eblan_command"><field name="CMD">/hudmodel</field>' +
'<statement name="DO">' +
'<block type="eblan_physics"><field name="FIELD">jumpPower</field>' +
'<value name="V"><block type="math_number"><field name="NUM">1.6</field></block></value>' +
'<next><block type="eblan_models_spawn"><field name="ID">ak47</field>' +
'<value name="X"><block type="math_number"><field name="NUM">0</field></block></value>' +
'<value name="Y"><block type="math_number"><field name="NUM">16</field></block></value>' +
'<value name="Z"><block type="math_number"><field name="NUM">0</field></block></value>' +
'<value name="SCALE"><block type="math_number"><field name="NUM">1.5</field></block></value>' +
'<value name="YAW"><block type="math_number"><field name="NUM">0</field></block></value>' +
'</block></next></block>' +
'</statement></block>' +
'</next></block>' +
'</statement></block></xml>'

};
