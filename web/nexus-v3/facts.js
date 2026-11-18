// Paraphrased, reviewed seed facts. No LLM request is made by idle animation.
export const FACTS = [
 {id:'venus-rotation',text:'Venus berotasi sekali dalam sekitar 243 hari Bumi; satu orbitnya hanya sekitar 225 hari Bumi.',reply:'Jadi periode rotasinya lebih panjang daripada tahunnya.',source:'NASA',url:'https://science.nasa.gov/venus/venus-facts/',verified_at:'2026-10-22',kind:'evergreen'},
 {id:'web-1989',text:'Tim Berners-Lee menciptakan World Wide Web pada 1989 saat bekerja di CERN.',reply:'Web dan internet punya sejarah yang berbeda.',source:'CERN',url:'https://home.cern/science/computing/the-birth-of-the-web',verified_at:'2026-10-22',kind:'evergreen'},
 {id:'first-website',text:'Website pertama dibuat untuk proyek World Wide Web dan berjalan pada komputer NeXT milik Berners-Lee.',reply:'Dokumentasi proyek pun bisa menjadi awal sesuatu yang besar.',source:'CERN',url:'https://home.cern/science/computing/the-birth-of-the-web/where-web-was-born/',verified_at:'2026-10-22',kind:'evergreen'},
 {id:'venus-moon',text:'Venus tidak mempunyai bulan alami.',reply:'Tetangganya, Bumi, punya satu Bulan.',source:'NASA',url:'https://science.nasa.gov/venus/venus-facts/',verified_at:'2026-10-22',kind:'evergreen'}
];
export function validFacts(items,now=Date.now()){
 return (Array.isArray(items)?items:[]).filter(f=>{
  if(!f||typeof f.id!=='string'||typeof f.text!=='string'||f.text.length>220||!f.source||!Number.isFinite(Date.parse(f.verified_at)))return false;
  try{if(new URL(f.url).protocol!=='https:')return false;}catch{return false;}
  const age=now-Date.parse(f.verified_at);return age>=-86400000&&age<(f.kind==='news'?2:365)*86400000;
 }).slice(0,48);
}
