// ===== DATA: teams, drivers, tracks =====
const ENGINES = {
  MER: { name: 'Mercedes', power: 92, rel: 88 },
  FER: { name: 'Ferrari', power: 89, rel: 85 },
  RBF: { name: 'Red Bull Ford', power: 84, rel: 80 },
  HON: { name: 'Honda', power: 79, rel: 74 },
  AUD: { name: 'Audi', power: 80, rel: 79 }
};

// works: team develops the engine itself
const TEAMS_2026 = [
  { id: 'mer', name: 'Mercedes', full: 'Mercedes-AMG Petronas F1 Team', color: '#00D7B6', engine: 'MER', works: true, aero: 88, chassis: 87, rel: 88, money: 140, sponsor: 9.0, dev: 1.10, drivers: ['russell', 'antonelli'] },
  { id: 'fer', name: 'Ferrari', full: 'Scuderia Ferrari HP', color: '#E8002D', engine: 'FER', works: true, aero: 87, chassis: 86, rel: 85, money: 140, sponsor: 9.5, dev: 1.05, drivers: ['leclerc', 'hamilton'] },
  { id: 'mcl', name: 'McLaren', full: 'McLaren Formula 1 Team', color: '#FF8000', engine: 'MER', works: false, aero: 87, chassis: 87, rel: 86, money: 135, sponsor: 9.0, dev: 1.10, drivers: ['norris', 'piastri'] },
  { id: 'rbr', name: 'Red Bull', full: 'Oracle Red Bull Racing', color: '#3671C6', engine: 'RBF', works: true, aero: 86, chassis: 86, rel: 80, money: 135, sponsor: 8.5, dev: 1.05, drivers: ['verstappen', 'hadjar'] },
  { id: 'wil', name: 'Williams', full: 'Atlassian Williams Racing', color: '#1868DB', engine: 'MER', works: false, aero: 81, chassis: 80, rel: 82, money: 95, sponsor: 6.0, dev: 0.95, drivers: ['albon', 'sainz'] },
  { id: 'rb', name: 'Racing Bulls', full: 'Visa Cash App Racing Bulls', color: '#6692FF', engine: 'RBF', works: false, aero: 79, chassis: 79, rel: 80, money: 90, sponsor: 5.5, dev: 0.90, drivers: ['lawson', 'lindblad'] },
  { id: 'ast', name: 'Aston Martin', full: 'Aston Martin Aramco F1 Team', color: '#229971', engine: 'HON', works: true, aero: 80, chassis: 79, rel: 72, money: 130, sponsor: 7.0, dev: 1.05, drivers: ['alonso', 'stroll'] },
  { id: 'has', name: 'Haas', full: 'TGR Haas F1 Team', color: '#B6BABD', engine: 'FER', works: false, aero: 80, chassis: 79, rel: 82, money: 85, sponsor: 5.0, dev: 0.90, drivers: ['ocon', 'bearman'] },
  { id: 'aud', name: 'Audi', full: 'Audi Revolut F1 Team', color: '#BB0A30', engine: 'AUD', works: true, aero: 78, chassis: 78, rel: 78, money: 125, sponsor: 6.5, dev: 1.05, drivers: ['hulkenberg', 'bortoleto'] },
  { id: 'alp', name: 'Alpine', full: 'BWT Alpine F1 Team', color: '#0093CC', engine: 'MER', works: false, aero: 81, chassis: 80, rel: 82, money: 95, sponsor: 6.0, dev: 0.95, drivers: ['gasly', 'colapinto'] },
  { id: 'cad', name: 'Cadillac', full: 'Cadillac Formula 1 Team', color: '#C9A227', engine: 'FER', works: false, aero: 75, chassis: 75, rel: 76, money: 115, sponsor: 6.0, dev: 1.00, drivers: ['perez', 'bottas'] }
];

// pace, racecraft, consistency, wet, tyres | age in 2026 | salary $M/yr | contract end (last season)
function D(id, name, code, num, nat, age, pace, craft, cons, wet, tyre, salary, until, pot) {
  return { id, name, code, num, nat, age, pace, craft, cons, wet, tyre, salary, until, pot: pot || 0 };
}
const DRIVERS_2026 = [
  D('norris', 'Lando Norris', 'NOR', 1, 'GB', 26, 93, 90, 88, 89, 90, 25, 2027),
  D('piastri', 'Oscar Piastri', 'PIA', 81, 'AU', 25, 92, 90, 90, 85, 90, 15, 2028, 1),
  D('russell', 'George Russell', 'RUS', 63, 'GB', 28, 91, 90, 90, 88, 88, 20, 2026),
  D('antonelli', 'Kimi Antonelli', 'ANT', 12, 'IT', 19, 87, 84, 80, 84, 82, 3, 2026, 4),
  D('leclerc', 'Charles Leclerc', 'LEC', 16, 'MC', 28, 93, 89, 87, 87, 86, 30, 2029),
  D('hamilton', 'Lewis Hamilton', 'HAM', 44, 'GB', 41, 88, 92, 88, 92, 90, 50, 2026),
  D('verstappen', 'Max Verstappen', 'VER', 3, 'NL', 28, 97, 95, 93, 97, 91, 55, 2028),
  D('hadjar', 'Isack Hadjar', 'HAD', 6, 'FR', 21, 86, 84, 82, 84, 82, 2, 2027, 3),
  D('albon', 'Alex Albon', 'ALB', 23, 'TH', 30, 86, 86, 88, 85, 87, 10, 2027),
  D('sainz', 'Carlos Sainz', 'SAI', 55, 'ES', 31, 88, 89, 88, 86, 88, 12, 2026),
  D('lawson', 'Liam Lawson', 'LAW', 30, 'NZ', 24, 82, 83, 78, 80, 80, 1.5, 2026, 2),
  D('lindblad', 'Arvid Lindblad', 'LIN', 41, 'GB', 18, 82, 80, 76, 79, 78, 1, 2027, 5),
  D('alonso', 'Fernando Alonso', 'ALO', 14, 'ES', 44, 89, 93, 90, 92, 91, 20, 2026),
  D('stroll', 'Lance Stroll', 'STR', 18, 'CA', 27, 79, 80, 77, 84, 80, 12, 2028),
  D('ocon', 'Esteban Ocon', 'OCO', 31, 'FR', 29, 84, 84, 85, 84, 84, 8, 2026),
  D('bearman', 'Oliver Bearman', 'BEA', 87, 'GB', 20, 85, 82, 80, 82, 81, 2, 2027, 4),
  D('hulkenberg', 'Nico Hülkenberg', 'HUL', 27, 'DE', 38, 85, 86, 89, 84, 86, 6, 2026),
  D('bortoleto', 'Gabriel Bortoleto', 'BOR', 5, 'BR', 21, 84, 82, 82, 82, 81, 2, 2027, 4),
  D('gasly', 'Pierre Gasly', 'GAS', 10, 'FR', 30, 86, 85, 86, 85, 85, 10, 2028),
  D('colapinto', 'Franco Colapinto', 'COL', 43, 'AR', 22, 80, 81, 76, 78, 79, 1, 2026, 2),
  D('perez', 'Sergio Pérez', 'PER', 11, 'MX', 36, 84, 86, 82, 85, 90, 10, 2027),
  D('bottas', 'Valtteri Bottas', 'BOT', 77, 'FI', 36, 84, 83, 88, 82, 85, 8, 2027)
];
// Free agents / reserves at the start
const FREE_2026 = [
  D('tsunoda', 'Yuki Tsunoda', 'TSU', 22, 'JP', 26, 84, 82, 79, 82, 80, 0, 0),
  D('doohan', 'Jack Doohan', 'DOO', 7, 'AU', 23, 79, 78, 76, 78, 77, 0, 0, 2),
  D('crawford', 'Jak Crawford', 'CRA', 21, 'US', 21, 79, 77, 78, 77, 77, 0, 0, 3),
  D('drugovich', 'Felipe Drugovich', 'DRU', 34, 'BR', 26, 79, 79, 82, 79, 79, 0, 0),
  D('aron', 'Paul Aron', 'ARO', 97, 'EE', 22, 78, 77, 77, 76, 77, 0, 0, 3),
  D('browning', 'Luke Browning', 'BRO', 15, 'GB', 24, 78, 77, 78, 77, 77, 0, 0, 2),
  D('fornaroli', 'Leonardo Fornaroli', 'FOR', 17, 'IT', 21, 79, 77, 80, 76, 78, 0, 0, 4),
  D('beganovic', 'Dino Beganovic', 'BEG', 19, 'SE', 22, 77, 76, 76, 76, 76, 0, 0, 3),
  D('martins', 'Victor Martins', 'MAR', 25, 'FR', 25, 77, 77, 76, 77, 77, 0, 0),
  D('hirakawa', 'Ryo Hirakawa', 'HIR', 28, 'JP', 32, 78, 78, 80, 79, 78, 0, 0),
  D('vesti', 'Frederik Vesti', 'VES', 26, 'DK', 24, 77, 77, 78, 76, 77, 0, 0),
  D('verschoor', 'Richard Verschoor', 'VSC', 29, 'NL', 25, 78, 77, 78, 78, 77, 0, 0),
  D('iwasa', 'Ayumu Iwasa', 'IWA', 40, 'JP', 24, 79, 78, 78, 79, 77, 0, 0, 2),
  D('osullivan', "Zak O'Sullivan", 'OSU', 39, 'GB', 21, 76, 76, 76, 75, 76, 0, 0, 3)
];

const FLAGS = { GB: '🇬🇧', AU: '🇦🇺', IT: '🇮🇹', MC: '🇲🇨', NL: '🇳🇱', FR: '🇫🇷', TH: '🇹🇭', ES: '🇪🇸', NZ: '🇳🇿', CA: '🇨🇦', DE: '🇩🇪', BR: '🇧🇷', AR: '🇦🇷', MX: '🇲🇽', FI: '🇫🇮', JP: '🇯🇵', US: '🇺🇸', EE: '🇪🇪', SE: '🇸🇪', DK: '🇩🇰', CN: '🇨🇳', BH: '🇧🇭', SA: '🇸🇦', AT: '🇦🇹', BE: '🇧🇪', HU: '🇭🇺', AZ: '🇦🇿', SG: '🇸🇬', QA: '🇶🇦', AE: '🇦🇪', TR: '🇹🇷', MY: '🇲🇾', PT: '🇵🇹', RU: '🇷🇺', KR: '🇰🇷', IN: '🇮🇳', ZA: '🇿🇦', CH: '🇨🇭', MA: '🇲🇦', PL: '🇵🇱', IE: '🇮🇪', CO: '🇨🇴', CZ: '🇨🇿', NO: '🇳🇴', IL: '🇮🇱', VE: '🇻🇪' };

// Rookie name pools for generated drivers
const NAME_POOL = {
  GB: [['Oliver', 'Thomas', 'Harry', 'Callum', 'Jamie', 'Alfie'], ['Hughes', 'Patel', 'Bennett', 'Walsh', 'Carter', 'Lloyd']],
  IT: [['Marco', 'Luca', 'Matteo', 'Andrea', 'Gabriele'], ['Rossi', 'Bianchi', 'Ferrara', 'Conti', 'Mancini']],
  FR: [['Théo', 'Hugo', 'Louis', 'Jules', 'Enzo'], ['Moreau', 'Laurent', 'Girard', 'Fontaine', 'Rousseau']],
  DE: [['Lukas', 'Felix', 'Jonas', 'Max', 'Tim'], ['Becker', 'Krause', 'Vogel', 'Hartmann', 'Brandt']],
  ES: [['Pablo', 'Álvaro', 'Diego', 'Sergio'], ['García', 'Navarro', 'Ortega', 'Romero']],
  BR: [['Rafael', 'Caio', 'Enzo', 'Pedro'], ['Silva', 'Costa', 'Moraes', 'Barbosa']],
  JP: [['Kaito', 'Ren', 'Sota', 'Haruto'], ['Sato', 'Nakamura', 'Kobayashi', 'Yamada']],
  US: [['Tyler', 'Mason', 'Logan', 'Ethan'], ['Brooks', 'Hayes', 'Reed', 'Morgan']],
  AU: [['Jack', 'Lachlan', 'Riley', 'Cooper'], ['Mitchell', 'Kelly', 'Murray', 'Ward']],
  NL: [['Daan', 'Sem', 'Thijs', 'Bram'], ['de Vries', 'Bakker', 'Visser', 'Smit']],
  CN: [['Wei', 'Hao', 'Yifan', 'Jun'], ['Zhang', 'Li', 'Chen', 'Wang']],
  SG: [['Ethan', 'Ryan', 'Marcus', 'Javier'], ['Tan', 'Lim', 'Ng', 'Goh']],
  MX: [['Diego', 'Santiago', 'Mateo'], ['Hernández', 'López', 'Ramírez']],
  SE: [['Oskar', 'Linus', 'Elias'], ['Lindqvist', 'Berg', 'Holm']],
  PL: [['Jakub', 'Kacper', 'Szymon'], ['Nowak', 'Kowalski', 'Zielinski']]
};

// ===== TRACKS =====
// v = estimated average lap speed for a modern car (km/h), ot = overtaking ease 0-1,
// df = downforce importance, pw = power importance, wear = tyre wear, rain = rain chance
function T(id, name, short, cc, km, v, ot, df, pw, wear, rain, era, pts, extra) {
  return Object.assign({ id, name, short, cc, km, v, ot, df, pw, wear, rain, era, pts }, extra || {});
}
const TRACKS = [
  // ---- 2026 calendar ----
  T('aus', 'Albert Park', 'Australia', 'AU', 5.278, 236, .45, .55, .55, .45, .18, 'current', [[30,85],[70,88],[85,80],[90,65],[82,50],[88,35],[80,18],[62,12],[45,15],[35,25],[22,22],[12,35],[15,55],[10,70]]),
  T('chn', 'Shanghai International', 'China', 'CN', 5.451, 205, .65, .55, .55, .65, .2, 'current', [[20,80],[75,80],[85,72],[80,62],[60,60],[55,50],[70,40],[88,30],[85,15],[60,12],[45,22],[50,32],[40,38],[20,30],[12,45],[25,55],[18,68]]),
  T('jpn', 'Suzuka', 'Japan', 'JP', 5.807, 230, .35, .75, .45, .6, .25, 'current', [[15,70],[40,72],[55,62],[50,50],[60,40],[72,35],[85,40],[90,55],[80,65],[70,55],[62,45],[55,30],[45,20],[30,18],[20,28],[25,40],[15,52]]),
  T('bhr', 'Bahrain International', 'Bahrain', 'BH', 5.412, 210, .75, .45, .6, .8, .02, 'current', [[20,85],[70,85],[80,78],[75,65],[55,62],[50,50],[65,40],[85,35],[88,20],[70,12],[50,18],[40,30],[25,28],[15,40],[22,55],[12,70]]),
  T('sau', 'Jeddah Corniche', 'Saudi Arabia', 'SA', 6.174, 250, .55, .4, .75, .35, .02, 'current', [[45,95],[55,90],[52,75],[58,60],[50,45],[56,30],[50,15],[45,5],[38,12],[42,30],[36,48],[42,62],[36,78],[40,92]]),
  T('mia', 'Miami International', 'Miami', 'US', 5.412, 215, .55, .5, .6, .55, .3, 'current', [[15,60],[50,62],[85,58],[90,48],[80,40],[60,42],[55,30],[70,22],[80,12],[55,8],[30,15],[25,30],[10,35],[8,48]]),
  T('can', 'Circuit Gilles Villeneuve', 'Canada', 'CA', 4.361, 210, .7, .35, .75, .4, .3, 'current', [[10,55],[20,45],[45,42],[75,38],[92,35],[95,45],[80,52],[55,58],[30,62],[15,66]]),
  T('mon', 'Circuit de Monaco', 'Monaco', 'MC', 3.337, 160, .03, .9, .2, .2, .15, 'current', [[30,70],[45,72],[55,60],[70,40],[80,30],[88,38],[85,50],[75,55],[70,68],[60,80],[45,85],[35,82],[25,78]], { laps: 78 }),
  T('bcn', 'Circuit de Barcelona-Catalunya', 'Barcelona', 'ES', 4.657, 210, .35, .75, .45, .7, .1, 'current', [[15,75],[70,78],[85,70],[80,55],[65,50],[70,35],[85,25],[75,12],[50,15],[40,28],[30,22],[18,30],[20,45],[10,60]]),
  T('aut', 'Red Bull Ring', 'Austria', 'AT', 4.318, 240, .65, .45, .65, .5, .3, 'current', [[15,70],[55,75],[90,60],[85,48],[50,40],[20,20],[10,30],[30,48],[20,58]]),
  T('gbr', 'Silverstone', 'Britain', 'GB', 5.891, 240, .55, .75, .5, .7, .35, 'current', [[30,85],[55,80],[70,88],[85,75],[78,60],[88,45],[80,30],[65,25],[55,12],[35,10],[25,25],[35,40],[20,50],[12,65],[20,78]]),
  T('bel', 'Spa-Francorchamps', 'Belgium', 'BE', 7.004, 235, .7, .5, .7, .5, .45, 'current', [[15,25],[25,10],[40,15],[60,30],[80,40],[90,55],[82,65],[70,60],[60,70],[65,85],[50,92],[35,80],[38,65],[25,55],[20,40]]),
  T('hun', 'Hungaroring', 'Hungary', 'HU', 4.381, 200, .2, .85, .3, .55, .15, 'current', [[20,80],[60,82],[80,75],[85,60],[70,55],[75,40],[85,28],[70,15],[45,18],[35,30],[45,42],[30,50],[15,60]]),
  T('ned', 'Zandvoort', 'Netherlands', 'NL', 4.259, 215, .2, .8, .35, .5, .3, 'current', [[20,70],[50,75],[75,72],[85,60],[78,45],[60,40],[70,25],[60,12],[40,15],[30,28],[42,40],[25,48],[12,58]]),
  T('ita', 'Monza', 'Italy', 'IT', 5.793, 260, .65, .2, .9, .4, .15, 'current', [[20,80],[80,80],[85,78],[88,72],[86,60],[84,40],[80,20],[72,12],[62,14],[58,22],[50,30],[40,26],[30,20],[20,22],[14,32],[12,50],[14,68]]),
  T('mad', 'Madring', 'Madrid', 'ES', 5.47, 215, .5, .6, .5, .5, .1, 'current', [[20,70],[60,72],[85,60],[80,45],[60,48],[50,35],[65,20],[45,10],[25,20],[30,35],[15,45],[10,60]]),
  T('aze', 'Baku City Circuit', 'Azerbaijan', 'AZ', 6.003, 210, .65, .4, .75, .35, .05, 'current', [[10,80],[85,80],[90,70],[80,62],[85,50],[70,45],[65,30],[45,25],[35,10],[22,15],[28,30],[20,45],[12,60]]),
  T('sgp', 'Marina Bay', 'Singapore', 'SG', 4.927, 180, .25, .85, .3, .6, .35, 'current', [[20,80],[80,82],[88,70],[75,62],[82,50],[70,40],[72,25],[55,18],[40,25],[30,15],[15,25],[22,40],[12,55],[18,68]], { laps: 62 }),
  T('usa', 'Circuit of the Americas', 'United States', 'US', 5.513, 205, .6, .65, .5, .65, .15, 'current', [[15,80],[25,65],[35,72],[50,62],[62,70],[75,60],[88,62],[90,48],[70,40],[55,35],[50,20],[65,12],[40,8],[25,18],[30,35],[10,40],[8,60]]),
  T('mex', 'Autódromo Hermanos Rodríguez', 'Mexico', 'MX', 4.304, 200, .5, .6, .6, .45, .15, 'current', [[15,30],[80,25],[90,35],[80,48],[85,62],[78,75],[60,72],[45,80],[30,75],[20,60],[10,45]]),
  T('bra', 'Interlagos', 'Brazil', 'BR', 4.309, 215, .7, .55, .55, .55, .45, 'current', [[50,15],[30,20],[20,35],[30,45],[50,40],[65,50],[60,62],[40,58],[25,68],[35,82],[60,85],[80,72],[85,50],[78,28],[68,15]]),
  T('lvg', 'Las Vegas Strip', 'Las Vegas', 'US', 6.201, 235, .7, .3, .8, .3, .03, 'current', [[10,60],[90,60],[92,45],[70,40],[72,25],[55,20],[40,30],[20,35],[8,45]]),
  T('qat', 'Lusail International', 'Qatar', 'QA', 5.419, 230, .4, .7, .45, .85, .02, 'current', [[15,70],[70,72],[88,60],[80,45],[88,30],[70,18],[45,15],[30,25],[40,40],[22,48],[12,58]]),
  T('abu', 'Yas Marina', 'Abu Dhabi', 'AE', 5.281, 205, .5, .55, .6, .45, .02, 'current', [[15,60],[35,65],[60,62],[85,58],[90,45],[75,40],[55,42],[60,30],[78,25],[70,12],[40,10],[20,20],[25,35],[10,45]]),
  // ---- Recent / modern former venues ----
  T('imo', 'Imola', 'Emilia-Romagna', 'IT', 4.909, 220, .25, .6, .55, .5, .3, '1980–2025', [[15,70],[45,78],[70,72],[85,60],[90,45],[80,30],[60,22],[40,15],[30,25],[38,40],[22,50],[10,60]]),
  T('ist', 'Istanbul Park', 'Turkey', 'TR', 5.338, 220, .6, .65, .55, .6, .2, '2005–2021', [[15,40],[30,20],[50,25],[45,40],[60,50],[80,35],[90,50],[80,70],[60,80],[40,72],[25,85],[12,70],[20,55]]),
  T('sep', 'Sepang', 'Malaysia', 'MY', 5.543, 210, .7, .6, .55, .75, .5, '1999–2017', [[15,50],[30,30],[50,35],[65,20],[85,30],[80,50],[60,55],[75,70],[85,85],[55,88],[35,80],[45,65],[25,70]]),
  T('nur', 'Nürburgring GP', 'Germany', 'DE', 5.148, 215, .5, .6, .5, .5, .4, '1984–2020', null),
  T('hok', 'Hockenheimring', 'Germany', 'DE', 4.574, 225, .6, .5, .6, .5, .3, '2002–2019', [[20,70],[40,80],[60,70],[85,40],[88,20],[75,15],[60,30],[45,45],[30,40],[15,50]]),
  T('por', 'Portimão', 'Portugal', 'PT', 4.653, 210, .45, .65, .5, .55, .1, '2020–2021', null),
  T('mug', 'Mugello', 'Tuscany', 'IT', 5.245, 230, .3, .75, .5, .65, .15, '2020', null),
  T('soc', 'Sochi Autodrom', 'Russia', 'RU', 5.848, 215, .45, .5, .6, .3, .15, '2014–2021', null),
  T('yeo', 'Korea International', 'Korea', 'KR', 5.615, 200, .6, .55, .6, .5, .25, '2010–2013', null),
  T('bud', 'Buddh International', 'India', 'IN', 5.125, 215, .55, .55, .6, .5, .02, '2011–2013', null),
  T('val', 'Valencia Street Circuit', 'Europe', 'ES', 5.419, 200, .15, .6, .5, .4, .05, '2008–2012', null),
  T('ind', 'Indianapolis', 'United States', 'US', 4.192, 215, .6, .4, .75, .4, .15, '2000–2007', null),
  T('mag', 'Magny-Cours', 'France', 'FR', 4.411, 205, .3, .6, .5, .5, .2, '1991–2008', null),
  T('ric', 'Paul Ricard', 'France', 'FR', 5.842, 215, .45, .5, .6, .55, .1, '1971–2022', [[10,60],[30,40],[60,38],[90,35],[95,45],[80,55],[60,60],[40,58],[25,68],[12,72]]),
  T('fuj', 'Fuji Speedway', 'Japan', 'JP', 4.563, 210, .55, .5, .65, .45, .4, '1976–77, 2007–08', null),
  // ---- Classic era ----
  T('hoc', 'Hockenheim (forest)', 'Germany', 'DE', 6.823, 245, .7, .2, .95, .35, .25, '1970–2001', [[30,90],[45,85],[55,75],[75,40],[82,15],[70,6],[60,15],[40,50],[25,72],[20,84]]),
  T('est', 'Estoril', 'Portugal', 'PT', 4.360, 200, .3, .65, .5, .55, .15, '1984–1996', null),
  T('jer', 'Jerez', 'Spain', 'ES', 4.428, 200, .35, .65, .45, .55, .1, '1986–1997', null),
  T('ade', 'Adelaide Street Circuit', 'Australia', 'AU', 3.780, 195, .45, .55, .55, .45, .2, '1985–1995', null),
  T('det', 'Detroit Street Circuit', 'United States', 'US', 4.023, 160, .1, .85, .3, .5, .15, '1982–1988', null),
  T('phx', 'Phoenix Street Circuit', 'United States', 'US', 3.798, 170, .2, .7, .4, .4, .02, '1989–1991', null),
  T('dal', 'Fair Park Dallas', 'United States', 'US', 3.901, 160, .15, .75, .35, .7, .05, '1984', null),
  T('cae', 'Caesars Palace', 'Las Vegas', 'US', 3.650, 170, .3, .7, .35, .6, .02, '1981–1982', null),
  T('lbc', 'Long Beach', 'United States', 'US', 3.275, 170, .3, .75, .4, .45, .05, '1976–1983', null),
  T('wat', 'Watkins Glen', 'United States', 'US', 5.435, 225, .5, .5, .6, .4, .3, '1961–1980', null),
  T('mos', 'Mosport Park', 'Canada', 'CA', 3.957, 215, .45, .6, .55, .45, .3, '1967–1977', null),
  T('kya', 'Kyalami', 'South Africa', 'ZA', 4.104, 220, .55, .55, .6, .55, .15, '1967–1993', null),
  T('jac', 'Jacarepaguá', 'Rio de Janeiro', 'BR', 5.031, 205, .5, .6, .5, .75, .2, '1978–1989', null),
  T('bai', 'Buenos Aires', 'Argentina', 'AR', 4.259, 200, .45, .6, .5, .5, .15, '1953–1998', null),
  T('bra2', 'Brands Hatch', 'Britain', 'GB', 4.206, 215, .35, .65, .5, .45, .35, '1964–1986', null),
  T('ost', 'Österreichring', 'Austria', 'AT', 5.942, 250, .55, .4, .75, .45, .3, '1970–1987', null),
  T('zol', 'Zolder', 'Belgium', 'BE', 4.262, 205, .35, .6, .5, .5, .4, '1973–1984', null),
  T('niv', 'Nivelles-Baulers', 'Belgium', 'BE', 3.724, 205, .45, .55, .5, .4, .35, '1972, 1974', null),
  T('and', 'Anderstorp', 'Sweden', 'SE', 4.031, 205, .45, .55, .5, .6, .3, '1973–1978', null),
  T('dij', 'Dijon-Prenois', 'France', 'FR', 3.801, 220, .45, .55, .55, .45, .25, '1974–1984', null),
  T('cle', 'Charade (Clermont-Ferrand)', 'France', 'FR', 8.055, 190, .3, .75, .4, .45, .3, '1965–1972', null),
  T('mtj', 'Montjuïc', 'Spain', 'ES', 3.791, 200, .25, .7, .45, .45, .1, '1969–1975', null),
  T('jar', 'Jarama', 'Spain', 'ES', 3.404, 190, .15, .75, .35, .5, .1, '1968–1981', null),
  T('zan2', 'Zandvoort (classic)', 'Netherlands', 'NL', 4.193, 225, .45, .55, .55, .5, .35, '1952–1985', null),
  T('nor', 'Nürburgring Nordschleife', 'Germany', 'DE', 22.835, 205, .35, .7, .55, .55, .45, '1951–1976', null, { laps: 14 }),
  T('spa2', 'Spa-Francorchamps (14 km)', 'Belgium', 'BE', 14.120, 255, .65, .35, .85, .45, .5, '1950–1970', [[20,30],[30,12],[42,18],[55,40],[75,60],[90,80],[80,90],[60,85],[40,80],[25,70],[15,50]], { laps: 22 }),
  T('rei', 'Reims-Gueux', 'France', 'FR', 8.302, 255, .75, .15, .95, .35, .15, '1950–1966', [[10,80],[90,78],[55,12],[40,20]], { laps: 37 }),
  T('rou', 'Rouen-Les-Essarts', 'France', 'FR', 6.542, 220, .4, .6, .55, .45, .25, '1952–1968', null),
  T('ain', 'Aintree', 'Britain', 'GB', 4.828, 215, .5, .5, .55, .4, .35, '1955–1962', null),
  T('ped', 'Pedralbes', 'Spain', 'ES', 6.316, 225, .5, .45, .65, .4, .1, '1951–1954', null),
  T('bre', 'Bremgarten', 'Switzerland', 'CH', 7.280, 220, .4, .6, .55, .45, .35, '1950–1954', null, { laps: 42 }),
  T('pes', 'Pescara', 'Italy', 'IT', 25.838, 230, .5, .4, .8, .4, .15, '1957', null, { laps: 12 }),
  T('ain2', 'Ain-Diab', 'Morocco', 'MA', 7.618, 230, .55, .45, .65, .45, .05, '1958', null),
  T('boa', 'Boavista', 'Portugal', 'PT', 7.407, 205, .35, .6, .55, .55, .15, '1958, 1960', null),
  T('mns', 'Monsanto', 'Portugal', 'PT', 5.440, 200, .35, .6, .55, .5, .15, '1959', null),
  T('avu', 'AVUS', 'Germany', 'DE', 8.300, 260, .8, .05, 1.0, .5, .3, '1959', [[45,4],[55,4],[57,10],[55,90],[52,96],[46,96],[43,90],[45,10]], { laps: 37 }),
  T('seb', 'Sebring', 'United States', 'US', 8.369, 200, .5, .55, .6, .7, .15, '1959', null),
  T('riv', 'Riverside', 'United States', 'US', 5.271, 215, .5, .55, .55, .5, .02, '1960', null),
  T('eas', 'Prince George (East London)', 'South Africa', 'ZA', 3.920, 215, .5, .5, .6, .45, .15, '1962–1965', null)
];
TRACKS.forEach(t => {
  t.base = +(t.km * 3600 / t.v).toFixed(3);
  if (!t.laps) t.laps = Math.max(10, Math.round(305 / t.km));
  t.pit = t.pit || (t.km > 10 ? 30 : 21);
});
const TRACK_BY_ID = Object.fromEntries(TRACKS.map(t => [t.id, t]));
const CAL_2026 = ['aus', 'chn', 'jpn', 'bhr', 'sau', 'mia', 'can', 'mon', 'bcn', 'aut', 'gbr', 'bel', 'hun', 'ned', 'ita', 'mad', 'aze', 'sgp', 'usa', 'mex', 'bra', 'lvg', 'qat', 'abu'];
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const COST_CAP = 215; // $M
const TYRES = {
  S: { name: 'Soft', col: '#FF3333', off: 0, wear: 0.050 },
  M: { name: 'Medium', col: '#FFD500', off: 0.6, wear: 0.032 },
  H: { name: 'Hard', col: '#EEEEEE', off: 1.15, wear: 0.022 },
  I: { name: 'Inter', col: '#3BB54A', off: 0, wear: 0.03 },
  W: { name: 'Wet', col: '#2F7BEF', off: 0, wear: 0.025 }
};
