import json, collections, statistics, math, hashlib
d = json.load(open('/mnt/user-data/uploads/f1db.json'))
countries = {c['id']: c['alpha2Code'] for c in d['countries']}
gp_short = {g['id']: g['shortName'].replace(' GP', '') for g in d['grandsPrix']}
cons_name = {c['id']: c['name'] for c in d['constructors']}
eng_name = {e['id']: e['name'] for e in d['engineManufacturers']}
entrant_name = {e['id']: e['name'] for e in d['entrants']}
drv = {x['id']: x for x in d['drivers']}

# ---------- circuit mapping ----------
CMAP = {'adelaide': 'ade', 'ain-diab': 'ain2', 'aintree': 'ain', 'anderstorp': 'and', 'austin': 'usa', 'avus': 'avu', 'bahrain': 'bhr', 'baku': 'aze',
        'brands-hatch': 'bra2', 'bremgarten': 'bre', 'buddh': 'bud', 'buenos-aires': 'bai', 'caesars-palace': 'cae', 'catalunya': 'bcn', 'clermont-ferrand': 'cle',
        'dallas': 'dal', 'detroit': 'det', 'dijon': 'dij', 'east-london': 'eas', 'estoril': 'est', 'fuji': 'fuj', 'hockenheimring': 'hok', 'hungaroring': 'hun',
        'imola': 'imo', 'indianapolis': 'ind', 'interlagos': 'bra', 'istanbul': 'ist', 'jacarepagua': 'jac', 'jarama': 'jar', 'jeddah': 'sau', 'jerez': 'jer',
        'kyalami': 'kya', 'las-vegas': 'lvg', 'long-beach': 'lbc', 'lusail': 'qat', 'madring': 'mad', 'magny-cours': 'mag', 'marina-bay': 'sgp', 'melbourne': 'aus',
        'mexico-city': 'mex', 'miami': 'mia', 'monaco': 'mon', 'monsanto': 'mns', 'montjuic': 'mtj', 'montreal': 'can', 'monza': 'ita', 'mosport': 'mos',
        'mugello': 'mug', 'nivelles': 'niv', 'nurburgring': 'nur', 'paul-ricard': 'ric', 'pedralbes': 'ped', 'pescara': 'pes', 'phoenix': 'phx', 'portimao': 'por',
        'porto': 'boa', 'reims': 'rei', 'riverside': 'riv', 'rouen': 'rou', 'sebring': 'seb', 'sepang': 'sep', 'shanghai': 'chn', 'silverstone': 'gbr', 'sirius': 'soc',
        'spa-francorchamps': 'bel', 'spielberg': 'aut', 'suzuka': 'jpn', 'valencia': 'val', 'watkins-glen': 'wat', 'yas-marina': 'abu', 'yeongam': 'yeo',
        'zandvoort': 'ned', 'zolder': 'zol'}
NEW_TRACKS = {}  # circuits not in the game yet
for c in d['circuits']:
    if c['id'] not in CMAP:
        tid = 'h_' + c['id'].replace('-', '_')
        CMAP[c['id']] = tid
        years = sorted({r['year'] for r in d['races'] if r['circuitId'] == c['id']})
        era = f"{years[0]}" + (f"–{years[-1]}" if years[-1] != years[0] else '')
        NEW_TRACKS[tid] = dict(name=c['fullName'], short=c['placeName'], cc=countries.get(c['countryId'], 'US'), km=c['length'], type=c['type'], era=era)

def track_id(r):
    t = CMAP[r['circuitId']]; L = r['courseLength'] or 0
    if t == 'bel' and L > 10: return 'spa2'
    if t == 'nur' and L > 15: return 'nor'
    if t == 'hok' and L > 6: return 'hoc'
    if t == 'ned' and r['year'] < 2020: return 'zan2'
    if t == 'aut' and L > 5: return 'ost'
    return t

# ---------- colours ----------
COL = {'ferrari': '#E8002D', 'mclaren': '#FF8000', 'williams': '#1868DB', 'mercedes': '#00D7B6', 'red-bull': '#3671C6', 'lotus': '#1B5E20', 'team-lotus': '#1B5E20',
       'brabham': '#2E86C1', 'tyrrell': '#1F3A93', 'renault': '#FFD800', 'benetton': '#16A34A', 'maserati': '#B71C1C', 'alfa-romeo': '#9B0000', 'vanwall': '#145A32',
       'cooper': '#2E7D32', 'brm': '#3E4A3D', 'matra': '#2453B3', 'march': '#E67E22', 'ligier': '#3A7BD5', 'jordan': '#F1C40F', 'toyota': '#CC0000', 'honda': '#EEEEEE',
       'toro-rosso': '#1E3A8A', 'alphatauri': '#2B4562', 'rb': '#6692FF', 'racing-bulls': '#6692FF', 'force-india': '#F596C8', 'racing-point': '#F596C8', 'sauber': '#00AEEF',
       'minardi': '#222222', 'arrows': '#FF7F00', 'jaguar': '#0B6623', 'stewart': '#DDDDDD', 'bmw-sauber': '#5B9BD5', 'gordini': '#1565C0', 'talbot-lago': '#4682B4',
       'aston-martin': '#229971', 'alpine': '#0093CC', 'haas': '#B6BABD', 'kick-sauber': '#52E252', 'audi': '#BB0A30', 'cadillac': '#C9A227', 'shadow': '#333333',
       'wolf': '#1A237E', 'hesketh': '#FFFFFF', 'surtees': '#E91E63', 'penske': '#C0392B', 'eagle': '#1E88E5', 'lola': '#D35400', 'porsche': '#BDC3C7', 'osella': '#7F8C8D',
       'zakspeed': '#EF5350', 'ats': '#F4D03F', 'fittipaldi': '#F9E79F', 'ensign': '#A93226', 'theodore': '#A04000', 'spirit': '#5D6D7E', 'toleman': '#2471A3', 'ags': '#ECF0F1',
       'larrousse': '#E59866', 'dallara': '#C0392B', 'footwork': '#E5E7E9', 'leyton-house': '#48C9B0', 'onyx': '#1ABC9C', 'coloni': '#F7DC6F', 'simtek': '#5B2C6F',
       'pacific': '#A9CCE3', 'forti': '#F4D03F', 'prost': '#1F618D', 'super-aguri': '#C0392B', 'spyker': '#E67E22', 'virgin': '#C0392B', 'marussia': '#AF1E2D',
       'manor': '#AF1E2D', 'hrt': '#7E5109', 'caterham': '#1E8449', 'midland': '#B03A2E', 'connaught': '#196F3D', 'lancia': '#1E3799', 'kurtis-kraft': '#999999', 'bugatti': '#2E86C1'}
def color(cid):
    if cid in COL: return COL[cid]
    h = int(hashlib.md5(cid.encode()).hexdigest()[:6], 16)
    hue = h % 360
    import colorsys
    r, g, b = colorsys.hls_to_rgb(hue / 360, 0.55, 0.55)
    return '#%02X%02X%02X' % (int(r * 255), int(g * 255), int(b * 255))

def spread(y):
    return 46 if y < 1960 else 38 if y < 1970 else 32 if y < 1980 else 30 if y < 1990 else 25 if y < 2000 else 21 if y < 2010 else 18

MECH_EXCLUDE = ('Accident', 'Collision', 'Spun', 'Disqualified', 'Withdrew', 'Physical', 'Injured', 'Illness', 'Driver', 'Fatal', 'Did not')
def is_crash(reason): return reason and any(k in reason for k in ('Accident', 'Collision', 'Spun'))
def is_mech(reason): return reason and not any(k in reason for k in MECH_EXCLUDE)

races_by_year = collections.defaultdict(list)
for r in d['races']:
    if r['grandPrixId'] == 'indianapolis': continue
    races_by_year[r['year']].append(r)

def ms(t):
    return t / 1000 if t else None

# ---------- per-race stats ----------
drv_delta = collections.defaultdict(list)   # (driver) -> [(year, delta)]
dy = collections.defaultdict(lambda: dict(n=0, delta=[], gp=[], wins=0, pods=0, fin=0, starts=0, crash=0, gain=[], teams=collections.Counter(), nums=collections.Counter()))
ty = collections.defaultdict(lambda: dict(pts=0, bestgrid=[], bestres=[], starts=0, mech=0, races=set(), entries=0, eng=collections.Counter(), entrant=collections.Counter()))
year_laps = collections.defaultdict(list)
for y, rs in races_by_year.items():
    for r in rs:
        res = [x for x in (r['raceResults'] or []) if x['positionText'] not in ('DNQ', 'DNPQ', 'EX', 'DNP')]
        if not res: continue
        year_laps[y].append(r['laps'] or 0)
        grid = [x for x in res if x['gridPositionNumber']]
        n = max(2, len(grid))
        fin = [x for x in res if x['positionNumber']]
        nf = max(2, len(fin))
        byteam = collections.defaultdict(list)
        for x in grid: byteam[x['constructorId']].append(x)
        for x in res:
            did, cid = x['driverId'], x['constructorId']
            D = dy[(did, y)]; T_ = ty[(cid, y)]
            D['teams'][cid] += 1; D['n'] += 1
            if x['driverNumber']: D['nums'][x['driverNumber']] += 1
            T_['races'].add(r['id']); T_['entries'] += 1; T_['pts'] += x['points'] or 0
            if x['engineManufacturerId']: T_['eng'][x['engineManufacturerId']] += 1
            if x['positionText'] != 'DNS':
                D['starts'] += 1; T_['starts'] += 1
                if x['positionNumber']: D['fin'] += 1
                if is_crash(x['reasonRetired']): D['crash'] += 1
                if is_mech(x['reasonRetired']): T_['mech'] += 1
            if x['positionNumber'] == 1: D['wins'] += 1
            if x['positionNumber'] and x['positionNumber'] <= 3: D['pods'] += 1
            if x['positionsGained'] is not None and x['positionNumber']: D['gain'].append(x['positionsGained'])
            if x['gridPositionNumber']:
                p = (x['gridPositionNumber'] - 1) / (n - 1)
                D['gp'].append(p)
                mates = [m for m in byteam[cid] if m['driverId'] != did]
                if mates:
                    mp = statistics.mean((m['gridPositionNumber'] - 1) / (n - 1) for m in mates)
                    D['delta'].append(mp - p)
        for cid, xs in byteam.items():
            T_ = ty[(cid, y)]
            T_['bestgrid'].append(min((x['gridPositionNumber'] - 1) / (n - 1) for x in xs))
        fby = collections.defaultdict(list)
        for x in fin: fby[x['constructorId']].append((x['positionNumber'] - 1) / (nf - 1))
        for cid, ps in fby.items(): ty[(cid, y)]['bestres'].append(min(ps))
        # entrant names
    for e in [s for s in d['seasons'] if s['year'] == y][0]['entrants']:
        for c in e['constructors']:
            n_ = sum(len(dr['rounds']) for dr in c['drivers'])
            ty[(c['constructorId'], y)]['entrant'][e['entrantId']] += n_

# career mean delta per driver (shrinkage prior)
career = collections.defaultdict(list)
for (did, y), D in dy.items(): career[did] += D['delta']
career_mean = {k: (sum(v) / (len(v) + 6)) for k, v in career.items()}

def driver_rating(did, y):
    D = dy[(did, y)]
    n = len(D['delta'])
    dS = (sum(D['delta']) + career_mean.get(did, 0) * 5) / (n + 5)
    st = max(1, D['starts'])
    winr, podr = D['wins'] / st, D['pods'] / st
    pace = 83 + 32 * dS + 7 * winr + 3 * podr
    gain = statistics.mean(D['gain']) if D['gain'] else 0
    craft = pace + max(-3, min(3, gain * 0.5)) - 1
    finr = D['fin'] / st
    cons = 78 + (finr - 0.5) * 18 - (D['crash'] / st) * 25 + 3 * dS * 10 / 10
    h = int(hashlib.md5((did + str(y)).encode()).hexdigest()[:8], 16)
    wet = pace + ((h % 9) - 4) * 0.7
    tyre = pace + (((h >> 4) % 9) - 4) * 0.6
    c = lambda v: round(max(55, min(99, v)), 1)
    return [c(pace), c(craft), c(cons), c(wet), c(tyre)]

def team_rating(cid, y):
    T_ = ty[(cid, y)]
    g = statistics.mean(T_['bestgrid']) if T_['bestgrid'] else 0.8
    rr = statistics.mean(T_['bestres']) if T_['bestres'] else 0.8
    car = 95 - (0.65 * g + 0.35 * rr) * spread(y)
    L = statistics.mean(year_laps[y]) if year_laps[y] else 60
    mrate = (T_['mech'] + 0.5) / (T_['starts'] + 2)  # per race-start
    mrate = min(0.75, max(0.02, mrate))
    p = -math.log(1 - mrate) / L
    rel = 100 - 15 * (p / 0.00075) ** (1 / 1.6)
    return round(max(40, min(97, car)), 1), round(max(20, min(97, rel)), 1)

# ---------- points systems per year ----------
def points_table(y):
    if y < 1960: return [8, 6, 4, 3, 2]
    if y == 1960: return [8, 6, 4, 3, 2, 1]
    if y < 1991: return [9, 6, 4, 3, 2, 1]
    if y < 2003: return [10, 6, 4, 3, 2, 1]
    if y < 2010: return [10, 8, 6, 5, 4, 3, 2, 1]
    return [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
BEST = {1950: 4, 1951: 4, 1952: 4, 1953: 4, 1954: 5, 1955: 5, 1956: 5, 1957: 5, 1958: 6, 1959: 5, 1960: 6, 1961: 5, 1962: 5, 1963: 6, 1964: 6, 1965: 6, 1966: 5,
        1967: 9, 1968: 10, 1969: 9, 1970: 11, 1971: 9, 1972: 10, 1973: 13, 1974: 13, 1975: 12, 1976: 14, 1977: 15, 1978: 14, 1979: 8, 1980: 10}
for y in range(1981, 1991): BEST[y] = 11

# ---------- assemble ----------
drivers_out, drv_index = [], {}
def didx(did):
    if did not in drv_index:
        x = drv[did]
        drv_index[did] = len(drivers_out)
        by = int(x['dateOfBirth'][:4]) if x.get('dateOfBirth') else 1930
        drivers_out.append([did, x['name'], x['abbreviation'], countries.get(x['nationalityCountryId'], 'XX'), by])
    return drv_index[did]

years_out, teams_used = {}, {}
for s in d['seasons']:
    y = s['year']; rs = sorted(races_by_year[y], key=lambda r: r['round'])
    if not rs: continue
    # calendar
    cal = []
    for r in rs:
        tid = track_id(r)
        q = [x['timeMillis'] for x in (r['qualifyingResults'] or []) if x.get('timeMillis')]
        q += [x['timeMillis'] for x in (r['startingGridPositions'] or []) if x.get('timeMillis')]
        fl = [x['timeMillis'] for x in (r['fastestLaps'] or []) if x.get('timeMillis')]
        pole = min(q) / 1000 if q else (min(fl) / 1000 * 0.99 if fl else None)
        km = r['courseLength']; laps = r['laps'] or r['scheduledLaps'] or 40
        if pole and km and (pole < km * 3600 / 380 or pole > km * 3600 / 80): pole = None  # garbage
        sprint = 1 if (r['sprintRaceResults'] or r['sprintRaceDate']) else 0
        win = (r['raceResults'] or [{}])[0].get('driverId') if r['raceResults'] else None
        cal.append([tid, gp_short.get(r['grandPrixId'], r['grandPrixId']), km, laps, round(pole * 0.99, 3) if pole else None, sprint, r['date'], didx(win) if win else -1])
    # roster
    nr = len(rs)
    starters = [len([x for x in (r['startingGridPositions'] or [])]) for r in rs if r['startingGridPositions']]
    target = min(26, int(statistics.median(starters)) if starters else 20)
    teams = []
    for (cid, yy), T_ in ty.items():
        if yy != y or not T_['races']: continue
        cars = max(1, min(3, round(T_['entries'] / nr)))
        teams.append([cid, len(T_['races']), cars, T_])
    teams.sort(key=lambda t: (-(t[1] / nr >= 0.3), -t[3]['pts'], -t[1]))
    # assign drivers to their main team
    main_team = {}
    for (did, yy), D in dy.items():
        if yy == y: main_team[did] = D['teams'].most_common(1)[0][0]
    roster_t, roster_d, used_cars = [], [], 0
    for cid, nraces, cars, T_ in teams:
        if used_cars >= target: break
        if nraces / nr < 0.3 and used_cars >= target * 0.8: continue
        cands = sorted([dd for dd, t in main_team.items() if t == cid], key=lambda dd: -dy[(dd, y)]['teams'][cid])
        if not cands: continue
        cars = min(cars, len(cands), target - used_cars)
        car, rel = team_rating(cid, y)
        eng = T_['eng'].most_common(1)[0][0] if T_['eng'] else cid
        ent = T_['entrant'].most_common(1)[0][0] if T_['entrant'] else cid
        works = 1 if eng.split('-')[0] in cid or cid.split('-')[0] in eng else 0
        roster_t.append([cid, entrant_name.get(ent, cons_name[cid]), eng_name.get(eng, eng), works, car, rel, cars])
        teams_used[cid] = [cons_name[cid], color(cid)]
        for dd in cands[:cars]:
            num = dy[(dd, y)]['nums'].most_common(1)[0][0] if dy[(dd, y)]['nums'] else '0'
            roster_d.append([didx(dd), cid, int(num) if str(num).isdigit() else 0] + driver_rating(dd, y))
        used_cars += cars
    in_roster = {drivers_out[x[0]][0] for x in roster_d}
    free = [dd for (dd, yy) in dy if yy == y and dd not in in_roster and dy[(dd, y)]['starts'] >= 1]
    free.sort(key=lambda dd: -driver_rating(dd, y)[0])
    free_out = [[didx(dd)] + driver_rating(dd, y) for dd in free[:12]]
    champ = next((x for x in s['driverStandings'] if x.get('championshipWon')), None)
    cchamp = next((x for x in (s['constructorStandings'] or []) if x.get('championshipWon')), None) if s.get('constructorStandings') else None
    years_out[y] = dict(cal=cal, pts=points_table(y), best=BEST.get(y, 0), teams=roster_t, drivers=roster_d, free=free_out,
                        champ=didx(champ['driverId']) if champ else -1, cchamp=cons_name.get(cchamp['constructorId']) if cchamp else None)
    for cid in [t[0] for t in roster_t]: pass

lay = collections.defaultdict(lambda: collections.defaultdict(list))
lay_len = {}
for r in d['races']:
    if r['grandPrixId'] == 'indianapolis': continue
    lay[track_id(r)][r['circuitLayoutId']].append(r['year']); lay_len[r['circuitLayoutId']] = r['courseLength']
layouts_out = {}
for tid, L in lay.items():
    arr = sorted([[lid, min(ys), max(ys), lay_len[lid]] for lid, ys in L.items()], key=lambda x: x[1])
    layouts_out[tid] = arr
out = dict(drivers=drivers_out, teams=teams_used, tracks=NEW_TRACKS, years=years_out, layouts=layouts_out)

