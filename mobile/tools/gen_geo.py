import os
import json,math,sys
sys.path.insert(0, os.environ.get('NE_DIR', '.'))
os.chdir(os.environ.get('NE_DIR', '.'))
from geomap import lcc, ee, R
M=[ # code,name,region,country,lat,lon,source,status
("DSM","Des Moines","Iowa","US",41.534,-93.663,"NOAA","live"),
("YYZ","Toronto Pearson","Ontario","CA",43.677,-79.631,"Environment Canada","soon"),
("MSP","Minneapolis–St Paul","Minnesota","US",44.882,-93.222,"NOAA","concept"),
("ORD","Chicago O'Hare","Illinois","US",41.979,-87.905,"NOAA","concept"),
("STL","St. Louis","Missouri","US",38.749,-90.370,"NOAA","concept"),
("SDF","Louisville","Kentucky","US",38.174,-85.736,"NOAA","concept"),
("DTW","Detroit","Michigan","US",42.212,-83.353,"NOAA","concept"),
("DEN","Denver","Colorado","US",39.856,-104.674,"NOAA","concept"),
("DFW","Dallas–Fort Worth","Texas","US",32.900,-97.040,"NOAA","concept"),
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
]
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
land=json.load(open("land.json"))["features"]; lakes=json.load(open("lakes.json"))["features"]
# Region
W,H=1000,640
ax,_=lcc(-128,46);bx,_=lcc(-58,46);s=W/(bx-ax);cx,cy=lcc(-93,42.5)
P=lambda lo,la:(W/2+(lcc(lo,la)[0]-cx)*s,H/2-(lcc(lo,la)[1]-cy)*s)
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
for lat in range(30,61,10): rg+="M"+"L".join("%.0f,%.0f"%P(lo,lat) for lo in range(-135,-50,3))
for lon in range(-130,-50,10): rg+="M"+"L".join("%.0f,%.0f"%P(lon,la) for la in range(24,64,3))
# World
GW,GH=1000,520; lon0=-15;zoom=1.05
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
    mk.append(dict(code=c,name=n,region=r,country=co,lat=la,lon=lo,source=src,status=st,region_xy=[round(rx,1),round(ry,1)],global_xy=[round(gx,1),round(gy,1)]))
ts=f"""/* AUTO-GENERATED by gen_geo.py from Natural Earth 1:50m (public domain). Do not edit by hand.
 * Region: Lambert conformal conic (standard parallels 35°/55°N, central meridian 95°W), viewBox 0 0 {W} {H}.
 * Global: Equal Earth (central meridian 15°W), viewBox 0 0 {GW} {GH}. */
export const REGION_VIEW = {{ width: {W}, height: {H} }} as const;
export const GLOBAL_VIEW = {{ width: {GW}, height: {GH} }} as const;
export const REGION_LAND = {json.dumps(rl)};
export const REGION_LAKES = {json.dumps(rk)};
export const REGION_GRATICULE = {json.dumps(rg)};
export const GLOBAL_LAND = {json.dumps(gl)};
export const GLOBAL_GRATICULE = {json.dumps(gg)};
"""
open(os.environ.get('OUT_DIR','.')+'/geo-paths.ts','w').write(ts)
json.dump(mk,open(os.environ.get('OUT_DIR','.')+'/markets.json','w'),ensure_ascii=False,indent=1)
print(len(ts), [ (m['code'],m['region_xy']) for m in mk[:20]])
