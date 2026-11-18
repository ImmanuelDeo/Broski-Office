// IDs and profiles are retained so historical runs remain attributable.
export const TEAMS = [
  {id:'reports',name:'Academic Atelier',description:'Praktikum · kerja praktik · proposal · tugas akhir',color:'#c6b6ef',center:[-10,-8],theme:'library'},
  {id:'engineering',name:'Engineering Studio',description:'Software · machine learning · sistem · quality assurance',color:'#91d8cb',center:[10,-8],theme:'laboratory'},
  {id:'supervision',name:'Mission Control',description:'Checkpoint · recovery · review seluruh tim',color:'#ebc785',center:[-10,8],theme:'control'},
  {id:'intelligence',name:'Observatory',description:'Jurnal · artikel · berita nasional dan internasional',color:'#9bbfed',center:[10,8],theme:'observatory'}
];
export const AGENTS = [
  {id:'analyst',name:'Atlas',team:'reports',role:'Research & report author',profile:'office-atlas',skin:'deku'},
  {id:'research-review',name:'Lyra',team:'reports',role:'Methodology & academic editor',profile:'office-lyra',skin:'choso'},
  {id:'builder',name:'Axel',team:'engineering',role:'Software engineer',profile:'office-axel',skin:'levi'},
  {id:'code-review',name:'Echo',team:'engineering',role:'QA & technical reviewer',profile:'office-echo',skin:'archer'},
  {id:'editor-1',name:'Nova',team:'engineering',role:'ML & data engineer',profile:'office-nova',skin:'eren'},
  {id:'editor-2',name:'Pixel',team:'engineering',role:'Systems & integration engineer',profile:'office-pixel',skin:'shinei'},
  {id:'planner',name:'Orion',team:'supervision',role:'Cross-team supervisor',profile:'office-orion',skin:'saber'},
  {id:'ops-review',name:'Mira',team:'intelligence',role:'Daily research & scraping',profile:'office-mira',skin:'lancer'}
];
export const SKINS = {
  eren:{hair:'#392b27',coat:'#50705b',accent:'#b3a590',style:'bun'},
  shinei:{hair:'#202633',coat:'#40566a',accent:'#c36a60',style:'fringe'},
  asta:{hair:'#d1d3d1',coat:'#272c39',accent:'#d3af65',style:'spike'},
  deku:{hair:'#244e40',coat:'#418a70',accent:'#e6e3cf',style:'spike'},
  choso:{hair:'#302c35',coat:'#71668e',accent:'#ded6c1',style:'twobuns'},
  levi:{hair:'#242936',coat:'#526754',accent:'#e6e0cf',style:'fringe'},
  archer:{hair:'#e5e5df',coat:'#a04b4d',accent:'#333c4b',style:'spike'},
  saber:{hair:'#d6ba71',coat:'#45679a',accent:'#ddd9ca',style:'bun'},
  lancer:{hair:'#273f71',coat:'#365d97',accent:'#dedbe3',style:'tail'}
};
