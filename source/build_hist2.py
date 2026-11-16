# Extended F1DB extraction: real poles/fastest laps, official names, per-round line-ups (stand-ins, shared cars),
# car/engine/tyre per team, retirement causes by era, tyre-war form, driver profiles + career stats, team history.
# Runs the original builder first so existing driver indices (used by saves) stay unchanged; new drivers are appended.
import json, collections, statistics, re
exec(open('/home/claude/f1/build_hist_core.py').read())
n_orig = len(drivers_out)

NON_ENTRY = ('DNQ', 'DNPQ', 'EX', 'DNP', 'DNS')
tyre_name = {t['id']: t['name'] for t in d['tyreManufacturers']}
chassis_name = {c['id']: c['name'] for c in d['chassis']}
def eng_desc(e):
    s = e['fullName']
    s = re.sub(r' T H$', ' turbo hybrid', s); s = re.sub(r' T$', ' turbo', s); s = re.sub(r' S$', ' supercharged', s)
    if e.get('aspiration') == 'SUPERCHARGED' and 'supercharged' not in s: s += ' supercharged'
    if e.get('aspiration') == 'TURBOCHARGED' and 'turbo' not in s: s += ' turbo'
    return s
engine_by_id = {e['id']: e for e in d['engines']}
r3 = lambda x: round(x, 3) if x is not None else None

def pole_of(r):
    q = r['qualifyingResults'] or []
    p = next((x for x in q if x['positionNumber'] == 1), None)
    t = None
    if p:
        t = p.get('q3Millis') or p.get('q2Millis') or p.get('timeMillis') or p.get('q1Millis')
        a1, a2 = p.get('q1Millis'), p.get('q2Millis')
        if p.get('timeMillis') and a1 and a2 and abs(p['timeMillis'] - (a1 + a2)) < 5: t = min(a1, a2)
        if r.get('qualifyingFormat') == 'AGGREGATE':  # 2005: pole decided on two laps added together; show the pole sitter's best single lap
            laps_ = [x['timeMillis'] for k in ('qualifying1Results', 'qualifying2Results') for x in (r.get(k) or []) if x.get('driverId') == p['driverId'] and x.get('timeMillis')]
            if laps_: t = min(laps_)
    if not p or not t:
        g = next((x for x in (r['startingGridPositions'] or []) if x.get('qualificationPositionNumber') == 1 and x.get('timeMillis')), None)
        if g: p, t = g, g['timeMillis']
    if not p or not t: return None
    km = r['courseLength'] or 0
    if km and (t / 1000 < km * 3600 / 380 or t / 1000 > km * 3600 / 60): return None
    return [r3(t / 1000), didx(p['driverId'])]

def fl_of(r):
    f = next((x for x in (r['fastestLaps'] or []) if x['positionNumber'] == 1 and x.get('timeMillis')), None)
    if not f: return None
    return [r3(f['timeMillis'] / 1000), didx(f['driverId']), f.get('lap') or 0]

# ---------- per-year second pass ----------
for s_ in d['seasons']:
    y = s_['year']
    if y not in years_out: continue
    Y = years_out[y]; rs = sorted(races_by_year[y], key=lambda r: r['round'])
    roster = {(drivers_out[x[0]][0], x[1]) for x in Y['drivers']}
    roster_ids = {drivers_out[x[0]][0] for x in Y['drivers']}
    roster_teams = {t[0] for t in Y['teams']}
    free_ids = {drivers_out[x[0]][0] for x in Y['free']}
    xt, xd, xd_ids = [], [], set()
    def need_team(cid):
        if cid in roster_teams or any(t[0] == cid for t in xt): return
        T_ = ty[(cid, y)]
        car, rel = team_rating(cid, y)
        eng = T_['eng'].most_common(1)[0][0] if T_['eng'] else cid
        ent = T_['entrant'].most_common(1)[0][0] if T_['entrant'] else cid
        works = 1 if eng.split('-')[0] in cid or cid.split('-')[0] in eng else 0
        xt.append([cid, entrant_name.get(ent, cons_name[cid]), eng_name.get(eng, eng), works, car, rel])
        teams_used.setdefault(cid, [cons_name[cid], color(cid)])
    def need_driver(did, cid, num):
        if did in roster_ids or did in free_ids or did in xd_ids: return
        xd_ids.add(did); need_team(cid)
        xd.append([didx(did), cid, int(num) if str(num).isdigit() else 0] + driver_rating(did, y))
    rx = []
    for r in rs:
        res = r['raceResults'] or []
        prim, shares, seen = [], [], set()
        for x in res:
            if x['positionText'] in NON_ENTRY or x['sharedCar']: continue
            if x['driverId'] in seen: continue
            seen.add(x['driverId']); prim.append(x)
        for x in res:
            if not x['sharedCar'] or x['positionText'] in NON_ENTRY: continue
            p = next((q for q in prim if q['constructorId'] == x['constructorId'] and q['positionText'] == x['positionText'] and q['driverId'] != x['driverId']), None)
            if not p: continue
            need_driver(x['driverId'], x['constructorId'], x['driverNumber'] or 0)
            e = next((s2 for s2 in shares if s2[0] == p['driverId']), None)
            if not e: shares.append([p['driverId'], [x['driverId']]])
            elif x['driverId'] not in e[1]: e[1].append(x['driverId'])
        lineup = {(x['driverId'], x['constructorId']) for x in prim}
        adds = []
        for x in prim:
            if (x['driverId'], x['constructorId']) in roster: continue
            need_driver(x['driverId'], x['constructorId'], x['driverNumber'] or 0); need_team(x['constructorId'])
            adds.append([didx(x['driverId']), x['constructorId'], int(x['driverNumber']) if str(x['driverNumber'] or '').isdigit() else 0])
        lin_ids = {a for a, _ in lineup}
        outs = [didx(did) for (did, cid) in roster if (did, cid) not in lineup]
        # tyre-war form: how much better/worse than usual each tyre maker's cars qualified at this race
        tyf = {}
        starters = [x for x in prim if x['gridPositionNumber']]
        makers = {x['tyreManufacturerId'] for x in starters if x['tyreManufacturerId']}
        if len(makers) >= 2 and len(starters) > 4:
            n = len(starters); acc = collections.defaultdict(list)
            for x in starters:
                gp_ = dy[(x['driverId'], y)]['gp']
                if not gp_ or not x['tyreManufacturerId']: continue
                acc[x['tyreManufacturerId']].append(statistics.mean(gp_) - (x['gridPositionNumber'] - 1) / (n - 1))
            for m, v in acc.items():
                if len(v) >= 2: tyf[tyre_name[m]] = round(statistics.mean(v), 3)
        o = {}
        pp = pole_of(r); fl = fl_of(r)
        if pp: o['p'] = pp
        if fl: o['f'] = fl
        if r.get('officialName'): o['o'] = r['officialName']
        if adds: o['a'] = adds
        if outs: o['x'] = outs
        if shares: o['s'] = [[didx(a), [didx(b) for b in bs]] for a, bs in shares]
        if tyf: o['ty'] = tyf
        rx.append(o)
    Y['rx'] = rx
    if xt: Y['xt'] = xt
    if xd: Y['xd'] = xd
    # car / engine / tyre per team
    car = {}
    for e in s_['entrants']:
        for c in e['constructors']:
            cid = c['constructorId']
            info = car.setdefault(cid, [[], [], []])
            for ch in c.get('chassis') or []:
                nm = chassis_name.get(ch['chassisId'])
                if nm and nm not in info[0]: info[0].append(nm)
            for en in c.get('engines') or []:
                e2 = engine_by_id.get(en['engineId'])
                if e2:
                    ds_ = eng_desc(e2)
                    if ds_ not in info[1]: info[1].append(ds_)
            for tm in c.get('tyreManufacturers') or []:
                nm = tyre_name.get(tm['tyreManufacturerId'])
                if nm and nm not in info[2]: info[2].append(nm)
    used = roster_teams | {t[0] for t in xt}
    Y['car'] = {cid: [' / '.join(v[0][:3]), ' / '.join(v[1][:2]), ' / '.join(v[2])] for cid, v in car.items() if cid in used}

# ---------- retirement causes by 5-year era ----------
CRASH = ('Accident', 'Collision', 'Spun off', 'Collision damage', 'Accident damage', 'Spun')
SKIP = ('Withdrew', 'Disqualified', 'infringement', 'Infringement', 'Underweight', 'underweight', 'Illegal', 'illegal', 'Push start', 'Outside assistance', 'Missed', 'Black flag', 'Stalled on grid', 'Physical', 'Injured', 'Injury', 'Illness', 'Did not', 'Retirement', 'Driver', 'Fatal', 'Unwell', 'Exhaustion', 'Excluded', 'Not classified', 'Fatigue', 'Eye injury', 'Hand injury', 'Neck', 'Heat', 'Tooth')
ret = {}
era_rates = {}
for e0 in range(1950, 2030, 5):
    mech, crash = collections.Counter(), collections.Counter(); starts = 0
    for y in range(e0, e0 + 5):
        for r in races_by_year.get(y, []):
            for x in r['raceResults'] or []:
                if x['positionText'] in NON_ENTRY: continue
                starts += 1
                rr = x['reasonRetired']
                if not rr or any(k in rr for k in SKIP): continue
                if any(rr.startswith(k) for k in CRASH): crash[rr] += 1
                else: mech[rr] += 1
    if not starts: continue
    ret[e0] = dict(m=[[k, v] for k, v in mech.most_common(28)], c=[[k, v] for k, v in crash.most_common(6)])
    era_rates[e0] = (round(sum(mech.values()) / starts, 3), round(sum(crash.values()) / starts, 3))

# ---------- modern (2026 game) ids ----------
MOD_T = {'mer': 'mercedes', 'fer': 'ferrari', 'mcl': 'mclaren', 'rbr': 'red-bull', 'wil': 'williams', 'rb': 'racing-bulls', 'ast': 'aston-martin', 'has': 'haas', 'aud': 'audi', 'alp': 'alpine', 'cad': 'cadillac'}
data_js = open('/home/claude/f1/data.js').read()
mod_d = {}
by_name = collections.defaultdict(list)
for x in d['drivers']: by_name[x['name']].append(x['id'])
for gid, nm in re.findall(r"D\('([a-z]+)', *'([^']*)'", data_js):
    c = by_name.get(nm) or by_name.get(nm.replace('Kimi Antonelli', 'Andrea Kimi Antonelli')) or []
    if not c:
        c = [x['id'] for x in d['drivers'] if x['lastName'] and nm.endswith(x['lastName']) and x['firstName'] and nm.split(' ')[0] in (x['firstName'], x['firstName'].split(' ')[-1])]
    if c: mod_d[gid] = didx(sorted(c, key=lambda i: -(drv[i].get('dateOfBirth') or '0')[:4].__len__())[0])

# ---------- real data per track for the free-running modern game (2024+) ----------
rt = collections.defaultdict(dict)
for r in d['races']:
    if r['year'] < 2024 or r['grandPrixId'] == 'indianapolis': continue
    tid = track_id(r); pp = pole_of(r); fl = fl_of(r)
    rt[tid][r['year']] = [pp, fl, r.get('officialName')]

# ---------- career stats per driver per season (official F1DB counting, Indy 500 included) ----------
title_d = {}; title_c = {}
for s_ in d['seasons']:
    for x in s_['driverStandings'] or []:
        if x.get('championshipWon'): title_d[(x['driverId'], s_['year'])] = 1
    for x in s_['constructorStandings'] or []:
        if x.get('championshipWon'): title_c[(x['constructorId'], s_['year'])] = 1
dstat = collections.defaultdict(lambda: [0] * 8)   # starts, wins, poles, podiums, fl, grand slams, title, points
cstat = collections.defaultdict(lambda: [0] * 8)   # starts(races), wins, poles, podiums, fl, 1-2s, title, points
for r in d['races']:
    y = r['year']; res = r['raceResults'] or []
    cs = set(); cw = set(); cp = set(); cf = set(); cpod = collections.Counter(); cpts = collections.Counter()
    for x in res:
        did, cid = x['driverId'], x['constructorId']; S = dstat[(did, y)]
        if x['positionText'] not in NON_ENTRY:
            if not x['sharedCar']: S[0] += 1
            cs.add(cid)
        if x['positionNumber'] == 1: S[1] += 1; cw.add(cid)
        if x.get('polePosition'): S[2] += 1; cp.add(cid)
        if x['positionNumber'] and x['positionNumber'] <= 3:
            S[3] += 1
            if not x['sharedCar']: cpod[cid] += 1
        if x.get('fastestLap'): S[4] += 1; cf.add(cid)
        if x.get('grandSlam'): S[5] += 1
        S[7] += x['points'] or 0; cpts[cid] += x['points'] or 0
    top2 = [x['constructorId'] for x in res if x['positionNumber'] in (1, 2) and not x['sharedCar']]
    for cid in cs: cstat[(cid, y)][0] += 1
    for cid in cw: cstat[(cid, y)][1] += 1
    for cid in cp: cstat[(cid, y)][2] += 1
    for cid, n in cpod.items(): cstat[(cid, y)][3] += n
    for cid in cf: cstat[(cid, y)][4] += 1
    if len(top2) == 2 and top2[0] == top2[1]: cstat[(top2[0], y)][5] += 1
    for cid, p in cpts.items(): cstat[(cid, y)][7] += p
for k in title_d: dstat[k][6] = 1
for k in title_c: cstat[k][6] = 1

# profiles for every driver referenced by the game (+ family members)
fam_type = {}
i = 0
while i < len(drivers_out):
    did = drivers_out[i][0]
    for f in drv[did].get('familyRelationships') or []: didx(f['driverId'])
    i += 1
cc = lambda cid: countries.get(cid, '') if cid else ''
prof = []
for did, *_ in drivers_out:
    x = drv[did]
    prof.append([x['fullName'], x.get('dateOfBirth') or '', x.get('placeOfBirth') or '', cc(x.get('countryOfBirthCountryId')), x.get('dateOfDeath') or '',
                 x.get('permanentNumber') or '', [[didx(f['driverId']), f['type']] for f in (x.get('familyRelationships') or [])]])
ds_out = {}
for (did, y), S in dstat.items():
    if did not in drv_index: continue
    ds_out.setdefault(drv_index[did], []).append([y] + [round(v, 2) if isinstance(v, float) else v for v in S])
for v in ds_out.values(): v.sort()
tp = {}
for c in d['constructors']:
    seasons = sorted([[y] + [round(v, 2) if isinstance(v, float) else v for v in S] for (cid, y), S in cstat.items() if cid == c['id']])
    if not seasons: continue
    tp[c['id']] = [c['name'], cc(c.get('countryId')), [[h['constructorId'], h['yearFrom'], h['yearTo']] for h in (c.get('chronology') or [])], seasons]
    teams_used.setdefault(c['id'], [c['name'], color(c['id'])])

# sanity checks against F1DB totals
for did in ('ayrton-senna', 'juan-manuel-fangio', 'lewis-hamilton', 'michael-schumacher'):
    rows = ds_out[drv_index[did]]; tot = [sum(r[k] for r in rows) for k in range(1, 8)]
    x = drv[did]; print(did, tot, [x['totalRaceStarts'], x['totalRaceWins'], x['totalPolePositions'], x['totalPodiums'], x['totalFastestLaps'], x['totalGrandSlams'], x['totalChampionshipWins']])
for cid in ('ferrari', 'mclaren', 'benetton'):
    tot = [sum(r[k] for r in tp[cid][3]) for k in range(1, 8)]; c = [c for c in d['constructors'] if c['id'] == cid][0]
    print(cid, tot, [c['totalRaceStarts'], c['totalRaceWins'], c['totalPolePositions'], c['totalPodiums'], c['totalFastestLaps'], c['total1And2Finishes'], c['totalChampionshipWins']])

assert [x[0] for x in drivers_out[:n_orig]] == [x[0] for x in json.loads(open('/tmp/hist_old.js').read()[len('const HIST = '):-2])['drivers']], 'index order changed'
for e0, (m_, c_) in era_rates.items(): ret[e0]['rate'] = [m_, c_]
out = dict(drivers=drivers_out, teams=teams_used, tracks=NEW_TRACKS, years=years_out, layouts=layouts_out, ret=ret)
js = 'const HIST = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('/home/claude/f1/hist.js', 'w').write(js)
hx = dict(prof=prof, ds=ds_out, tp=tp, modD=mod_d, modT=MOD_T, rt=rt)
js2 = 'const HX = ' + json.dumps(hx, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('/home/claude/f1/hist2.js', 'w').write(js2)
print('hist.js', len(js), 'hist2.js', len(js2), 'drivers', n_orig, '->', len(drivers_out))
print('era rates (mech, crash per start)', era_rates)
print('modern map', len(mod_d), {k: drivers_out[v][1] for k, v in list(mod_d.items())[:6]})
Y = years_out[1980]; print('1980 rounds with changes', sum(1 for o in Y['rx'] if 'a' in o or 'x' in o), 'xd', len(Y.get('xd', [])), 'xt', len(Y.get('xt', [])))
print('1980 r1', {k: v for k, v in Y['rx'][0].items()})
print('1955 shares', [o.get('s') for o in years_out[1955]['rx']])
print('2005 ty', [o.get('ty') for o in years_out[2005]['rx']][:5], '1984 ty', [o.get('ty') for o in years_out[1984]['rx']][:4]); print('car 1976 ferrari', years_out[1976]['car'].get('ferrari'), '2005 ty', years_out[2005]['rx'][8].get('ty'))
