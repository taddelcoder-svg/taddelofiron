'use strict';
// Epochen – deutsche Provinznamen (epochenunabhaengig). Natural Earth hat nicht fuer
// jede Region einen deutschen Namen; hier werden englische Namen uebersetzt.

// Verwaltungs-Praefixe weglassen ("Woiwodschaft Pommern" -> "Pommern")
const PRAEFIX = /^(Autonome[rs]? (Gebiet|Kreis|Republik|Region|Okrug|Bezirk|Kommune)( der| des)?|Département|Gouvernement|Woiwodschaft|Kreis|Präfektur|Bezirk|Woblast|Komitat|Wilaya|Gemeinde|Gespanschaft|Provinz|Region|Oblast|Distrikt|Kanton|Gebiet|Republik)\s+/;

// Ganze Namen
const GENAU = {
  'Western Australia':'Westaustralien', 'Northern Territory':'Nordterritorium', 'South Australia':'Südaustralien',
  'New South Wales':'Neusüdwales', 'British Columbia':'Britisch-Kolumbien', 'Kongo Central':'Unterkongo',
  'Eastern Equatoria':'Äquatoria Ost', 'Western Equatoria':'Äquatoria West', 'Central Equatoria':'Äquatoria Mitte',
  'Upper Nile':'Oberer Nil', 'Western Bahr el Ghazal':'Bahr al-Ghazal West', 'Northern Bahr el Ghazal':'Bahr al-Ghazal Nord',
  'Matabeleland North':'Matabeleland Nord', 'Matabeleland South':'Matabeleland Süd', 'Mashonaland West':'Maschonaland West',
  'Mashonaland East':'Maschonaland Ost', 'Mashonaland Central':'Maschonaland Mitte', 'East Sepik':'Sepik Ost',
  'West New Britain':'Neubritannien West', 'East New Britain':'Neubritannien Ost', 'New Ireland':'Neuirland',
  'Upper Demerara-Berbice':'Demerara', 'Windward Islands':'Inseln über dem Winde', 'North Andros':'Andros',
  'South West Singapore':'Singapur', 'North Yorkshire':'Yorkshire', 'Andamanen und Nikobaren':'Andamanen',
  'Southern Highlands':'Südliches Hochland', 'Western Highlands':'Westliches Hochland', 'Eastern Highlands':'Östliches Hochland'
};

// Allgemeine Namen ("Northern", "Coast" …) bekommen den Landesnamen davor
const LANDESNAME = {
  GHA:'Goldküste', ZMB:'Nordrhodesien', ZWE:'Südrhodesien', KEN:'Kenia', UGA:'Uganda', MWI:'Njassaland', SLE:'Sierra Leone',
  GMB:'Gambia', NGA:'Nigeria', TZA:'Tanganjika', SDN:'Sudan', SDS:'Sudan', BWA:'Betschuanaland', PNG:'Neuguinea',
  SLB:'Salomonen', LKA:'Ceylon', MMR:'Burma', SYC:'Seychellen', MUS:'Mauritius', FJI:'Fidschi', CMR:'Kamerun',
  RWA:'Ruanda', BDI:'Urundi', ZAF:'Südafrika', LBR:'Liberia', USA:'Vereinigte Staaten', SGP:'Singapur', BHS:'Bahamas', ASM:'Amerikanisch-Samoa'
};
const RICHTUNG = {
  'Northern':'Nord', 'Western':'West', 'Eastern':'Ost', 'Southern':'Süd', 'Central':'Mitte', 'North West':'Nordwest',
  'North-Western':'Nordwest', 'North Western':'Nordwest', 'North-Eastern':'Nordost', 'North Eastern':'Nordost',
  'South West':'Südwest', 'South-Western':'Südwest', 'South East':'Südost', 'South-Eastern':'Südost', 'Coast':'Küste',
  'Central River':'Mitte', 'Upper River':'Oberlauf', 'Lower River':'Unterlauf', 'Outer Islands':'Außeninseln',
  'Black River':'Black River', 'Upper East':'Nordost', 'Upper West':'Nordwest', 'Greater Accra':'Accra', 'Ashanti':'Aschanti'
};

function deutsch(n, adm0){
  n = n.replace(PRAEFIX, '').trim() || n;
  if (GENAU[n]) return GENAU[n];
  if (RICHTUNG[n] && LANDESNAME[adm0]) return LANDESNAME[adm0] + ' ' + RICHTUNG[n];
  return n;
}

module.exports = { deutsch };
