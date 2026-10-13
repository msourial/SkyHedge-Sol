import json,math
R=math.radians
p1,p2,l0,f0=R(35),R(55),R(-95),R(45)
n=math.log(math.cos(p1)/math.cos(p2))/math.log(math.tan(math.pi/4+p2/2)/math.tan(math.pi/4+p1/2))
F=math.cos(p1)*math.tan(math.pi/4+p1/2)**n/n
rho=lambda f:F/math.tan(math.pi/4+f/2)**n
r0=rho(f0)
def lcc(lon,lat):
    r=rho(R(lat));t=n*(R(lon)-l0);return r*math.sin(t),r0-r*math.cos(t)
DSM=(-93.66,41.53);YYZ=(-79.63,43.68)
def mk(W,H,clat=43.6,lonA=-127,lonB=-59,clon=-93):
    ax,ay=lcc(lonA,46);bx,by=lcc(lonB,46)
    s=W/(bx-ax); cx,cy=lcc(clon,clat)
    P=lambda lo,la:(W/2+(lcc(lo,la)[0]-cx)*s,H/2-(lcc(lo,la)[1]-cy)*s)
    def path(geom):
        out=""
        polys=geom["coordinates"] if geom["type"]=="MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            for ring in poly:
                pts=[P(*c[:2]) for c in ring]
                if all(x<-60 or x>W+60 for x,y in pts) or all(y<-60 or y>H+60 for x,y in pts): continue
                out+="M"+"L".join(f"{x:.1f},{y:.1f}" for x,y in pts)+"Z"
        return out
    g=""
    for f in json.load(open("land.json"))["features"]:
        if f["properties"].get("ADM0_A3") in("USA","CAN","MEX"):
            g+=f'<path d="{path(f["geometry"])}" fill="rgba(94,200,255,.045)" stroke="rgba(94,200,255,.28)" stroke-width=".8"/>'
    for f in json.load(open("adm1.json"))["features"]:
        if f["properties"].get("adm0_a3") in("USA","CAN"):
            g+=f'<path d="{path(f["geometry"])}" fill="none" stroke="rgba(160,190,215,.13)" stroke-width=".6"/>'
    for f in json.load(open("lakes.json"))["features"]:
        d=path(f["geometry"])
        if d:g+=f'<path d="{d}" fill="rgba(94,200,255,.10)" stroke="rgba(94,200,255,.22)" stroke-width=".5"/>'
    grid=""
    for lat in range(30,56,5):
        grid+='<path d="M'+"L".join("%.1f,%.1f"%P(lo,lat) for lo in range(-110,-60))+'" fill="none" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 3"/>'
    for lon in range(-110,-60,5):
        grid+='<path d="M'+"L".join("%.1f,%.1f"%P(lon,la) for la in range(28,58))+'" fill="none" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 3"/>'
    return grid+g,P(*DSM),P(*YYZ),P

def ee(lon,lat):
    A1,A2,A3,A4=1.340264,-0.081106,0.000893,0.003796
    t=math.asin(math.sqrt(3)/2*math.sin(R(lat)));t2=t*t;t6=t2**3
    x=2*math.sqrt(3)*R(lon)*math.cos(t)/(3*(9*A4*t6*t2+7*A3*t6+3*A2*t2+A1))
    y=t*(A1+A2*t2+t6*(A3+A4*t2))
    return x,y
def world(W,H,lon0=-15,zoom=1.22):
    s=W/(2*ee(180,0)[0])*zoom;ym=ee(0,12)[1]
    P=lambda lo,la:(W/2+ee(((lo-lon0+180)%360)-180,la)[0]*s,H/2-(ee(0,la)[1]-ym)*s)
    def path(geom):
        out=""
        polys=geom["coordinates"] if geom["type"]=="MultiPolygon" else [geom["coordinates"]]
        for poly in polys:
            for ring in poly:
                pts=[];prev=None
                for c in ring:
                    x,y=P(*c[:2])
                    if prev is not None and abs(x-prev)>W/2: pts.append(None)
                    pts.append((x,y));prev=x
                seg="";first=True
                for p in pts:
                    if p is None: first=True;continue
                    seg+=("M" if first else "L")+f"{p[0]:.1f},{p[1]:.1f}";first=False
                out+=seg+"Z"
        return out
    g=""
    for lat in range(-60,90,30):
        g+='<path d="M'+"L".join("%.1f,%.1f"%P(lo,lat) for lo in range(int(lon0)-179,int(lon0)+180,3))+'" fill="none" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 3"/>'
    for lon in range(-180,180,30):
        g+='<path d="M'+"L".join("%.1f,%.1f"%P(lon+lon0+0.01,la) for la in range(-88,89,4))+'" fill="none" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 3"/>'
    for f in json.load(open("land.json"))["features"]:
        if f["properties"].get("ADM0_A3")=="ATA": continue
        g+=f'<path d="{path(f["geometry"])}" fill="rgba(94,200,255,.05)" stroke="rgba(160,190,215,.16)" stroke-width=".4"/>'
    return g,P
