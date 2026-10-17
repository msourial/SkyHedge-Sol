import os
import json,math,sys
sys.path.insert(0, os.environ.get('NE_DIR', '.'))
os.chdir(os.environ.get('NE_DIR', '.'))
from geomap import lcc, ee, R
M=[ # code,name,region,country,lat,lon,source,status
("DSM","Des Moines","Iowa","US",41.534,-93.663,"NOAA","live"),
("YYZ","Toronto Pearson","Ontario","CA",43.677,-79.631,"Environment Canada","soon"),
("MSP","Minneapolis–St Paul","Minnesota","US",44.882,-93.222,"NOAA","concept"),
("ORD","Chicago O'Hare","Illinois","US",41.979,-87.905,"NOAA","ready"),
("STL","St. Louis","Missouri","US",38.749,-90.370,"NOAA","concept"),
("SDF","Louisville","Kentucky","US",38.174,-85.736,"NOAA","concept"),
("DTW","Detroit","Michigan","US",42.212,-83.353,"NOAA","concept"),
("DEN","Denver","Colorado","US",39.856,-104.674,"NOAA","concept"),
("DFW","Dallas–Fort Worth","Texas","US",32.900,-97.040,"NOAA","live"),
("ATL","Atlanta","Georgia","US",33.641,-84.428,"NOAA","concept"),
("YOW","Ottawa","Ontario","CA",45.322,-75.667,"Environment Canada","concept"),
("YUL","Montréal","Québec","CA",45.470,-73.741,"Environment Canada","concept"),
("YHZ","Halifax","Nova Scotia","CA",44.881,-63.509,"Environment Canada","concept"),
("YVR","Vancouver","British Columbia","CA",49.195,-123.184,"Environment Canada","concept"),
("YYC","Calgary","Alberta","CA",51.131,-114.010,"Environment Canada","concept"),
("YEG","Edmonton","Alberta","CA",53.310,-113.580,"Environment Canada","concept"),
("YXE","Saskatoon","Saskatchewan","CA",52.171,-106.700,"Environment Canada","concept"),
("YQR","Regina","Saskatchewan","CA",50.432,-104.666,"Environment Canada","concept"),
("YWG","Winnipeg","Manitoba","CA",49.910,-97.240,"Environment Canada","concept"),
("MEX","Mexico City","CDMX","MX",19.436,-99.072,"SMN · CONAGUA","concept"),
("BOG","Bogotá","Cundinamarca","CO",4.702,-74.147,"IDEAM","concept"),
("LIM","Lima","Lima","PE",-12.022,-77.114,"SENAMHI","concept"),
("EZE","Buenos Aires","Buenos Aires","AR",-34.822,-58.536,"SMN Argentina","concept"),
("GRU","São Paulo","São Paulo","BR",-23.435,-46.473,"INMET","concept"),
("GIG","Rio de Janeiro","Rio de Janeiro","BR",-22.810,-43.251,"INMET","concept"),
("BSB","Brasília","Distrito Federal","BR",-15.871,-47.918,"INMET","concept"),
("LOS","Lagos","Lagos","NG",6.577,3.321,"NiMet","concept"),
("ACC","Accra","Greater Accra","GH",5.605,-0.167,"Ghana Meteorological Agency","concept"),
("NBO","Nairobi","Nairobi","KE",-1.319,36.928,"Kenya Meteorological Department","concept"),
("JNB","Johannesburg","Gauteng","ZA",-26.139,28.246,"South African Weather Service","concept"),
("DXB","Dubai","Dubai","AE",25.253,55.364,"UAE NCM","concept"),
("RUH","Riyadh","Riyadh","SA",24.958,46.699,"Saudi NCM","concept"),
("BOM","Mumbai","Maharashtra","IN",19.089,72.866,"IMD","concept"),
("DEL","Delhi","Delhi","IN",28.556,77.100,"IMD","concept"),
("BLR","Bengaluru","Karnataka","IN",13.199,77.706,"IMD","concept"),
("DAC","Dhaka","Dhaka","BD",23.843,90.398,"BMD","concept"),
("SGN","Ho Chi Minh City","Ho Chi Minh City","VN",10.819,106.652,"NCHMF","concept"),
("MNL","Manila","Metro Manila","PH",14.509,121.020,"PAGASA","concept"),
("CGK","Jakarta","Banten","ID",-6.126,106.656,"BMKG","concept"),
("NYC","New York (Central Park)","New York","US",40.779,-73.969,"NOAA","live"),
("MIA","Miami","Florida","US",25.793,-80.291,"NOAA","ready"),
("LAX","Los Angeles","California","US",33.9381,-118.3867,"NOAA","ready"),
("SEA","Seattle","Washington","US",47.4447,-122.3144,"NOAA","ready"),
("BOS","Boston","Massachusetts","US",42.3606,-71.0097,"NOAA","ready"),
("AUS","Austin","Texas","US",30.1831,-97.6800,"NOAA","ready"),
("MCI","Kansas City","Missouri","US",39.297,-94.714,"NOAA","concept"),
("OMA","Omaha","Nebraska","US",41.303,-95.894,"NOAA","concept"),
("MEM","Memphis","Tennessee","US",35.042,-89.977,"NOAA","concept"),
("LBB","Lubbock","Texas","US",33.664,-101.823,"NOAA","concept"),
("FAT","Fresno","California","US",36.776,-119.718,"NOAA","concept"),
("PHX","Phoenix","Arizona","US",33.434,-112.012,"NOAA","concept"),
("YQB","Québec City","Québec","CA",46.791,-71.393,"Environment Canada","concept"),
("YYT","St. John's","Newfoundland and Labrador","CA",47.619,-52.752,"Environment Canada","concept"),
("SCL","Santiago","Santiago Metropolitan","CL",-33.393,-70.786,"DMC Chile","concept"),
("UIO","Quito","Pichincha","EC",-0.129,-78.358,"INAMHI","concept"),
("REC","Recife","Pernambuco","BR",-8.126,-34.923,"INMET","concept"),
("CAI","Cairo","Cairo","EG",30.122,31.406,"Egyptian Meteorological Authority","concept"),
("CMN","Casablanca","Casablanca-Settat","MA",33.367,-7.590,"DGM Morocco","concept"),
("ADD","Addis Ababa","Addis Ababa","ET",8.978,38.799,"Ethiopian Meteorology Institute","concept"),
("DAR","Dar es Salaam","Dar es Salaam","TZ",-6.878,39.203,"Tanzania Meteorological Authority","concept"),
("KHI","Karachi","Sindh","PK",24.906,67.161,"PMD","concept"),
("CCU","Kolkata","West Bengal","IN",22.655,88.447,"IMD","concept"),
("MAA","Chennai","Tamil Nadu","IN",12.990,80.169,"IMD","concept"),
("CMB","Colombo","Western Province","LK",7.181,79.884,"Sri Lanka Dept. of Meteorology","concept"),
("BKK","Bangkok","Bangkok","TH",13.690,100.750,"TMD","concept"),
("KUL","Kuala Lumpur","Selangor","MY",2.746,101.710,"MetMalaysia","concept"),
("LHR","London Heathrow","England","GB",51.470,-0.454,"Met Office","concept"),
("CDG","Paris CDG","Île-de-France","FR",49.010,2.548,"Météo-France","concept"),
("MAD","Madrid","Madrid","ES",40.472,-3.561,"AEMET","concept"),
("FRA","Frankfurt","Hesse","DE",50.033,8.571,"DWD","concept"),
("IST","Istanbul","Istanbul","TR",41.275,28.752,"Turkish State Meteorological Service","concept"),
("HND","Tokyo Haneda","Tokyo","JP",35.552,139.780,"JMA","concept"),
("ICN","Seoul Incheon","Incheon","KR",37.463,126.441,"KMA","concept"),
("TPE","Taipei","Taoyuan","TW",25.078,121.233,"CWA","concept"),
("SYD","Sydney","New South Wales","AU",-33.946,151.177,"Bureau of Meteorology","concept"),
("AKL","Auckland","Auckland","NZ",-37.008,174.792,"MetService","concept"),
]
# NOAA GHCND stations already in shared/cities.ts + methodology-v1.json (data pipeline exists; no Devnet market account yet)
STATIONS={"DSM":"GHCND:USW00014933","ORD":"GHCND:USW00094846","NYC":"GHCND:USW00094728","MIA":"GHCND:USW00012839","DFW":"GHCND:USW00003927","LAX":"GHCND:USW00023174","SEA":"GHCND:USW00024233","BOS":"GHCND:USW00014739","AUS":"GHCND:USW00013904"}
# Short map labels (default: full name). Keep <= ~11 chars so they fit beside a pin.
SHORT={"YYZ":"Toronto","MSP":"Minneapolis","ORD":"Chicago","DFW":"Dallas","MEX":"CDMX","EZE":"BA","GIG":"Rio","JNB":"Joburg","SGN":"HCMC",
 "NYC":"NYC","LAX":"LA","SEA":"Seattle","BOS":"Boston","AUS":"Austin","MCI":"KC","YQB":"Québec","ADD":"Addis","DAR":"Dar","KUL":"KL","LHR":"London","CDG":"Paris","HND":"Tokyo","ICN":"Seoul"}
GROUP={"US":"North America","CA":"North America","MX":"Latin America","CO":"Latin America","PE":"Latin America","AR":"Latin America","BR":"Latin America","CL":"Latin America","EC":"Latin America",
 "NG":"Africa","GH":"Africa","KE":"Africa","ZA":"Africa","EG":"Africa","MA":"Africa","ET":"Africa","TZ":"Africa","AE":"Middle East","SA":"Middle East",
 "IN":"South Asia","BD":"South Asia","PK":"South Asia","LK":"South Asia","VN":"Southeast Asia","PH":"Southeast Asia","ID":"Southeast Asia","TH":"Southeast Asia","MY":"Southeast Asia",
 "GB":"Europe","FR":"Europe","ES":"Europe","DE":"Europe","TR":"Europe","JP":"East Asia","KR":"East Asia","TW":"East Asia","AU":"Oceania","NZ":"Oceania"}
def simplify(pts,tol):
    out=[]
    for p in pts:
        if not out or abs(p[0]-out[-1][0])+abs(p[1]-out[-1][1])>=tol: out.append(p)
    return out
def ring_d(pts,W,H,tol,minpts=4):
    pts=simplify(pts,tol)
    if len(pts)<minpts: return ""
    if all(x<-40 or x>W+40 for x,y in pts) or all(y<-40 or y>H+40 for x,y in pts): return ""
    return "M"+"L".join(f"{x:.0f},{y:.0f}" for x,y in pts)+"Z"
def polys(g):
    return g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
MONLY=os.environ.get("GEO_MARKETS_ONLY")=="1"
land=[] if MONLY else json.load(open("land.json"))["features"]; lakes=[] if MONLY else json.load(open("lakes.json"))["features"]
# Region
W,H=1000,760  # extended south to ~20N so Florida/Miami and the Gulf coast fit; north edge unchanged
ax,_=lcc(-128,46);bx,_=lcc(-58,46);s=W/(bx-ax);cx,cy=lcc(-93,42.5)
P=lambda lo,la:(W/2+(lcc(lo,la)[0]-cx)*s,320-(lcc(lo,la)[1]-cy)*s)
rl="";
for f in land:
    if f["properties"].get("ADM0_A3") in ("USA","CAN","MEX","GTM","CUB","BHS","GRL","BLZ","HND"):
        for poly in polys(f["geometry"]):
            for ring in poly[:1]: rl+=ring_d([P(*c[:2]) for c in ring],W,H,3)
rk=""
for f in lakes:
    for poly in polys(f["geometry"]):
        rk+=ring_d([P(*c[:2]) for c in poly[0]],W,H,3,6)
rg=""
for lat in range(20,61,10): rg+="M"+"L".join("%.0f,%.0f"%P(lo,lat) for lo in range(-135,-50,3))
for lon in range(-130,-50,10): rg+="M"+"L".join("%.0f,%.0f"%P(lon,la) for la in range(18,64,3))
# World
GW,GH=1000,520; lon0=10;zoom=1.0  # centre 10E keeps Auckland/Sydney east of the wrap line
gs=GW/(2*ee(180,0)[0])*zoom; ym=ee(0,12)[1]
Q=lambda lo,la:(GW/2+ee(((lo-lon0+180)%360)-180,la)[0]*gs,GH/2-(ee(0,la)[1]-ym)*gs)
gl=""
for f in land:
    if f["properties"].get("ADM0_A3")=="ATA": continue
    for poly in polys(f["geometry"]):
        ring=poly[0]; pts=[Q(*c[:2]) for c in ring]
        # split at wrap
        seg=[];prev=None;parts=[]
        for p in pts:
            if prev and abs(p[0]-prev[0])>GW/2: parts.append(seg);seg=[]
            seg.append(p);prev=p
        parts.append(seg)
        for sg in parts: gl+=ring_d(sg,GW,GH,2.5)
gg=""
for lat in range(-60,90,30): gg+="M"+"L".join("%.0f,%.0f"%Q(lo,lat) for lo in range(lon0-179,lon0+180,4))
for lon in range(-180,180,30): gg+="M"+"L".join("%.0f,%.0f"%Q(lon+lon0+0.01,la) for la in range(-84,85,6))
mk=[]
for c,n,r,co,la,lo,src,st in M:
    rx,ry=P(lo,la); gx,gy=Q(lo,la)
    mk.append(dict(short=SHORT.get(c,n),group=GROUP[co],station=STATIONS.get(c),code=c,name=n,region=r,country=co,lat=la,lon=lo,source=src,status=st,region_xy=[round(rx,1),round(ry,1)],global_xy=[round(gx,1),round(gy,1)]))
ts=f"""/* AUTO-GENERATED by gen_geo.py from Natural Earth 1:50m (public domain). Do not edit by hand.
 * Region: Lambert conformal conic (standard parallels 35°/55°N, central meridian 95°W), viewBox 0 0 {W} {H}.
 * Global: Equal Earth (central meridian 10°E), viewBox 0 0 {GW} {GH}. */
export const REGION_VIEW = {{ width: {W}, height: {H} }} as const;
export const GLOBAL_VIEW = {{ width: {GW}, height: {GH} }} as const;
export const REGION_LAND = {json.dumps(rl)};
export const REGION_LAKES = {json.dumps(rk)};
export const REGION_GRATICULE = {json.dumps(rg)};
export const GLOBAL_LAND = {json.dumps(gl)};
export const GLOBAL_GRATICULE = {json.dumps(gg)};
"""
if not MONLY: open(os.environ.get('OUT_DIR','.')+'/geo-paths.ts','w').write(ts)
json.dump(mk,open(os.environ.get('OUT_DIR','.')+'/markets.json','w'),ensure_ascii=False,indent=1)
assert all(len(m['short'])<=12 for m in mk), [m['short'] for m in mk if len(m['short'])>12]
print(len(ts), [ (m['code'],m['region_xy']) for m in mk[:20]])

# markets-data.ts: catalogue consumed by src/markets-catalog.ts
rows=[]
for m in mk:
    st=f', station: "{m["station"]}"' if m["station"] else ""
    rows.append(f'  {{ code: "{m["code"]}", name: {json.dumps(m["name"],ensure_ascii=False)}, short: {json.dumps(m["short"],ensure_ascii=False)}, region: {json.dumps(m["region"],ensure_ascii=False)}, country: "{m["country"]}", group: "{m["group"]}", lat: {m["lat"]}, lon: {m["lon"]}, source: {json.dumps(m["source"],ensure_ascii=False)}, status: "{m["status"]}"{st}, regionXY: [{m["region_xy"][0]}, {m["region_xy"][1]}], globalXY: [{m["global_xy"][0]}, {m["global_xy"][1]}] }},')
open(os.environ.get('OUT_DIR','.')+'/markets-data.ts','w').write("/* AUTO-GENERATED by tools/gen_geo.py. Do not edit by hand. */\nimport type { CatalogMarket } from \"./markets-catalog.ts\";\n\nexport const MARKET_DATA: readonly CatalogMarket[] = [\n"+"\n".join(rows)+"\n];\n")
