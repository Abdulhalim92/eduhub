"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowRight, ChevronRight, Sparkles, SlidersHorizontal, Star, MessageCircle, Users, Building2, Briefcase, LocateFixed } from "lucide-react";
import { C, FH, FB, INSTITUTIONS, PHOTOS, CATEGORY_META, REGION_LABEL, type CategoryKey } from "@/lib/data";
import { InstitCard } from "@/components/InstitCard";
import { SubjectMotifs } from "@/components/SubjectMotifs";
import { useReveal, revealStyle } from "@/lib/useReveal";
import { useAppState } from "@/lib/app-state";
import { useT } from "@/lib/i18n";
import { detectCoords, haversine } from "@/lib/geo";

const CATEGORY_KEYS: CategoryKey[] = ["cat_kg", "cat_school", "cat_center", "cat_uni"];

const STATS = [
  { n:"2 400+",  l:{ru:"Учреждений", tg:"Муассисаҳо"} },
  { n:"45 000+", l:{ru:"Отзывов", tg:"Шарҳҳо"} },
  { n:"120 000+",l:{ru:"Семей", tg:"Оилаҳо"} },
  { n:"4.7",     l:{ru:"Ср. рейтинг", tg:"Рейтинги миёна"} },
];

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { region } = useAppState();
  const t = useT();
  // точные координаты — только в памяти текущей сессии, не персистятся (минимизация PII)
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  function handleSearch() { router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search"); }

  function locateMe() {
    setLocating(true);
    detectCoords()
      .then(setMyCoords)
      .catch(() => {})
      .finally(() => setLocating(false));
  }

  // деградация: точные координаты → выбранный регион → вся страна (по рейтингу)
  const nearby = useMemo(() => {
    if (myCoords) {
      return [...INSTITUTIONS]
        .sort((a, b) => haversine(myCoords, a.geo) - haversine(myCoords, b.geo))
        .slice(0, 4);
    }
    const pool = region ? INSTITUTIONS.filter(i => i.region === region) : INSTITUTIONS;
    return [...pool].sort((a,b)=>b.score-a.score).slice(0,4);
  }, [region, myCoords]);

  const { ref: statsRef, visible: statsVisible } = useReveal<HTMLDivElement>();
  const { ref: missionRef, visible: missionVisible } = useReveal<HTMLDivElement>();
  const { ref: catRef, visible: catVisible } = useReveal<HTMLDivElement>();
  const { ref: topRef, visible: topVisible } = useReveal<HTMLDivElement>();
  const { ref: howRef, visible: howVisible } = useReveal<HTMLDivElement>();

  return (
    <div style={{fontFamily:FB}}>
      {/* ── HERO ── */}
      <section style={{position:"relative",overflow:"hidden",padding:"96px 28px 100px",textAlign:"center"}}>
        <img src={PHOTOS.heroLearning} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.48}}/>
        <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg, ${C.overlay}99 0%, ${C.overlay}CC 60%, ${C.overlay} 100%)`}}/>
        <SubjectMotifs/>

        <div style={{position:"relative",maxWidth:780,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"6px 14px",borderRadius:999,border:`1px solid ${C.teal}66`,background:`${C.teal}22`,marginBottom:22}}>
            <Sparkles size={13} style={{color:C.teal}}/>
            <span style={{fontSize:12.5,fontWeight:700,color:C.teal,fontFamily:FH,letterSpacing:".04em"}}>{t({ru:"TripAdvisor для образования Таджикистана", tg:"TripAdvisor барои маорифи Тоҷикистон"})}</span>
          </div>

          <h1 style={{fontFamily:FH,fontWeight:900,fontSize:"clamp(34px,5.5vw,62px)",lineHeight:1.1,color:"#fff",marginBottom:18,letterSpacing:"-.02em"}}>
            {t({ru:"Найдите образование,", tg:"Маорифе ёбед,"})}<br/>
            <span style={{color:C.teal}}>{t({ru:"которому можно доверять", tg:"ки метавон боварӣ кард"})}</span>
          </h1>
          <p style={{fontSize:"clamp(14px,1.8vw,17px)",color:"rgba(255,255,255,.72)",marginBottom:38,lineHeight:1.65,maxWidth:560,margin:"0 auto 38px"}}>
            {t({ru:"Сады, школы, учебные центры и вузы Таджикистана — в одном каталоге с честными оценками по 9 параметрам и реальными отзывами родителей и студентов.",
                tg:"Боғчаҳо, мактабҳо, марказҳои таълимӣ ва донишгоҳҳои Тоҷикистон — дар як каталог бо бақои ростқавлона аз рӯи 9 меъёр ва шарҳҳои воқеии волидайн ва донишҷӯён."})}
          </p>

          <div style={{display:"flex",maxWidth:560,margin:"0 auto",borderRadius:14,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,.5)",border:`1px solid ${C.teal}44`}}>
            <div style={{flex:1,display:"flex",alignItems:"center",gap:10,background:C.s1,padding:"14px 18px"}}>
              <Search size={17} style={{color:C.teal,flexShrink:0}}/>
              <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()} placeholder={t({ru:"Школа, детсад, район…", tg:"Мактаб, боғча, ноҳия…"})}
                style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:15,color:C.text,fontFamily:FB}}/>
            </div>
            <button onClick={handleSearch} style={{padding:"0 26px",background:C.teal,color:C.overlay,fontFamily:FH,fontWeight:800,fontSize:14,whiteSpace:"nowrap",flexShrink:0,border:"none",cursor:"pointer"}}>
              {t({ru:"Найти", tg:"Ёфтан"})}
            </button>
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginTop:16}}>
            {[{ru:"Лучшие школы",tg:"Беҳтарин мактабҳо"},{ru:"С развозкой",tg:"Бо расонидан"},{ru:"Проверенные МОН РТ",tg:"Санҷидашуда аз ВМО ҶТ"},{ru:"Рядом с метро",tg:"Наздики метро"}].map((l,i)=>(
              <button key={i} onClick={handleSearch} style={{fontSize:12.5,fontWeight:600,padding:"5px 13px",borderRadius:8,border:"1px solid rgba(255,255,255,.22)",color:"rgba(255,255,255,.8)",background:"rgba(255,255,255,.08)",fontFamily:FH,cursor:"pointer"}}>
                {t(l)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"28px 28px"}}>
        <div style={{maxWidth:1260,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {STATS.map((s,i)=>(
            <div key={s.n} style={{textAlign:"center",...revealStyle(statsVisible,i*60)}}>
              <p style={{fontFamily:FH,fontWeight:900,fontSize:30,color:C.teal,marginBottom:4}}>{s.n}</p>
              <p style={{fontSize:13,color:C.sub}}>{t(s.l)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION ── */}
      <section ref={missionRef} style={{maxWidth:1260,margin:"0 auto",padding:"64px 28px 0",...revealStyle(missionVisible)}}>
        <div style={{marginBottom:24}}>
          <h2 style={{fontFamily:FH,fontWeight:900,fontSize:"clamp(22px,3vw,30px)",color:C.text,letterSpacing:"-.02em"}}>
            {t({ru:"Руководства",tg:"Дастурҳо"})}
          </h2>
          <p style={{fontSize:14,color:C.sub,marginTop:4}}>
            {t({ru:"Пошаговые инструкции: как пользоваться EduHub родителям, соискателям и учреждениям",tg:"Дастурҳои қадам ба қадам: чӣ гуна аз EduHub истифода баранд волидайн, ҷуяндагони кор ва муассисаҳо"})}
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
          {[
            {
              photo: PHOTOS.heroGuideP, icon: Users,
              title: {ru:"Родителям и студентам", tg:"Ба волидайн ва донишҷӯён"},
              desc: {ru:"Бесплатно ищите, сравнивайте по 9 параметрам, читайте отзывы и пишите учреждениям напрямую в чате.",
                     tg:"Ройгон ҷустуҷӯ кунед, аз рӯи 9 меъёр муқоиса кунед, шарҳҳо хонед ва бевосита дар чат ба муассисаҳо нависед."},
              cta: {ru:"Подробнее для родителей", tg:"Муфассал барои волидайн"}, href:"/guide/parents",
            },
            {
              photo: PHOTOS.heroGuideA, icon: Briefcase,
              title: {ru:"Соискателям", tg:"Ба ҷуяндагони кор"},
              desc: {ru:"Находите открытые вакансии в образовательных учреждениях и откликайтесь напрямую в чате.",
                     tg:"Дар муассисаҳои таълимӣ ҷои холии корро ёбед ва бевосита дар чат ҷавоб диҳед."},
              cta: {ru:"Подробнее для соискателей", tg:"Муфассал барои ҷуяндагони кор"}, href:"/guide/applicants",
            },
            {
              photo: PHOTOS.heroGuideI, icon: Building2,
              title: {ru:"Учреждениям", tg:"Ба муассисаҳо"},
              desc: {ru:"Привлекайте новых учеников, получайте честную обратную связь и отвечайте на отзывы в своём кабинете.",
                     tg:"Хонандагони навро ҷалб кунед, бозхӯрди ростқавлона гиред ва дар кабинети худ ба шарҳҳо ҷавоб диҳед."},
              cta: {ru:"Подробнее для учреждений", tg:"Муфассал барои муассисаҳо"}, href:"/guide/institutions",
            },
          ].map(a=>(
            <div key={a.href} style={{borderRadius:18,overflow:"hidden",border:`1px solid ${C.border}`,background:C.s1}}>
              <div style={{position:"relative",height:120,overflow:"hidden"}}>
                <img src={a.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg,${C.overlay}10 0%,${C.overlay}D8 100%)`}}/>
                <div style={{position:"absolute",bottom:12,left:14,width:38,height:38,borderRadius:10,background:"rgba(0,0,0,.45)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <a.icon size={18} color="#fff"/>
                </div>
              </div>
              <div style={{padding:"20px 22px 24px"}}>
                <h3 style={{fontFamily:FH,fontWeight:800,fontSize:17,color:C.text,marginBottom:8}}>{t(a.title)}</h3>
                <p style={{fontSize:13.5,color:C.sub,lineHeight:1.65,marginBottom:16}}>{t(a.desc)}</p>
                <Link href={a.href} style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:FH,fontWeight:700,fontSize:13.5,color:C.teal,textDecoration:"none"}}>
                  {t(a.cta)} <ArrowRight size={14}/>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section style={{maxWidth:1260,margin:"0 auto",padding:"64px 28px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28}}>
          <div>
            <h2 style={{fontFamily:FH,fontWeight:900,fontSize:"clamp(22px,3vw,32px)",color:C.text,letterSpacing:"-.02em"}}>{t("nav.categories")}</h2>
            <p style={{fontSize:14,color:C.sub,marginTop:4}}>{t({ru:"Выберите тип учреждения", tg:"Навъи муассисаро интихоб кунед"})}</p>
          </div>
        </div>
        <div ref={catRef} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {CATEGORY_KEYS.map((k,i)=>{
            const meta = CATEGORY_META[k];
            const Icon = meta.icon;
            const count = INSTITUTIONS.filter(x=>x.tk===k).length;
            return (
              <Link key={k} href={`/search?type=${k}`}
                style={{borderRadius:18,overflow:"hidden",border:`1px solid ${C.border}`,background:C.s1,cursor:"pointer",textDecoration:"none",display:"block",...revealStyle(catVisible,i*60)}}>
                <div style={{position:"relative",height:128,overflow:"hidden"}}>
                  <img src={meta.heroPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",inset:0,background:`linear-gradient(180deg,${C.overlay}10 0%,${C.overlay}D8 100%)`}}/>
                  <div style={{position:"absolute",top:12,left:12,width:36,height:36,borderRadius:10,background:"rgba(0,0,0,.45)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon size={17} color="#fff"/>
                  </div>
                  <p style={{position:"absolute",bottom:12,left:14,right:14,fontFamily:FH,fontWeight:800,fontSize:16.5,color:"#fff"}}>{t(meta.plural)}</p>
                </div>
                <div style={{padding:"14px 16px 16px"}}>
                  <p style={{fontSize:12.5,color:C.sub,marginBottom:12,minHeight:32}}>{t(meta.desc)}</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700,color:meta.color,fontFamily:FH}}>{count} {t({ru:"учр.", tg:"муасс."})}</span>
                    <ArrowRight size={14} style={{color:meta.color}}/>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── NEARBY / TOP RATED ── */}
      <section style={{maxWidth:1260,margin:"0 auto",padding:"56px 28px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:28}}>
          <div>
            <h2 style={{fontFamily:FH,fontWeight:900,fontSize:"clamp(22px,3vw,32px)",color:C.text,letterSpacing:"-.02em"}}>
              {myCoords ? t({ru:"Учреждения рядом с вами", tg:"Муассисаҳо дар наздикии шумо"})
                : region ? t({ru:"Учреждения в вашем регионе", tg:"Муассисаҳо дар минтақаи шумо"})
                : t({ru:"Лучшие учреждения", tg:"Беҳтарин муассисаҳо"})}
            </h2>
            <p style={{fontSize:14,color:C.sub,marginTop:4}}>
              {myCoords ? t({ru:"По расстоянию от вашего местоположения", tg:"Аз рӯи масофа аз ҷои шумо"})
                : region ? t(REGION_LABEL[region])
                : t({ru:"По оценкам родителей Таджикистана", tg:"Аз рӯи бақои волидайни Тоҷикистон"})}
            </p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!myCoords && (
              <button onClick={locateMe} disabled={locating} style={{display:"flex",alignItems:"center",gap:6,fontFamily:FH,fontWeight:700,fontSize:13.5,color:C.sub,padding:"8px 14px",borderRadius:9,border:`1px solid ${C.border}`,background:"transparent",cursor:locating?"default":"pointer"}}>
                <LocateFixed size={14}/> {locating ? t("nav.gpsLocating") : t({ru:"Точнее по GPS", tg:"Аниқтар аз рӯи GPS"})}
              </button>
            )}
            <Link href="/search" style={{display:"flex",alignItems:"center",gap:5,fontFamily:FH,fontWeight:700,fontSize:13.5,color:C.teal,padding:"8px 14px",borderRadius:9,border:`1px solid ${C.teal}40`,background:`${C.teal}10`,textDecoration:"none"}}>
              {t({ru:"Все учреждения", tg:"Ҳама муассисаҳо"})} <ChevronRight size={14}/>
            </Link>
          </div>
        </div>
        <div ref={topRef} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18}}>
          {nearby.map((inst,i)=>(
            <div key={inst.id} style={revealStyle(topVisible,i*70)}>
              <InstitCard inst={inst} onClick={()=>router.push(`/institutions/${inst.id}`)}/>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section ref={howRef} style={{maxWidth:1260,margin:"0 auto",padding:"56px 28px 80px"}}>
        <h2 style={{fontFamily:FH,fontWeight:900,fontSize:"clamp(22px,3vw,32px)",color:C.text,textAlign:"center",letterSpacing:"-.02em",marginBottom:8}}>{t({ru:"Как это работает", tg:"Ин чӣ гуна кор мекунад"})}</h2>
        <p style={{fontSize:14,color:C.sub,textAlign:"center",marginBottom:44}}>{t({ru:"Четыре шага до осознанного выбора", tg:"Чор қадам то интихоби огоҳона"})}</p>
        <div style={{position:"relative"}}>
          <div style={{position:"absolute",top:23,left:"12.5%",right:"12.5%",height:1,background:`linear-gradient(90deg,transparent,${C.border},${C.border},transparent)`}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,position:"relative"}}>
            {[
              {n:"01",icon:SlidersHorizontal,t:{ru:"Ищите",tg:"Ҷустуҷӯ кунед"},d:{ru:"Фильтруйте по району, типу, цене, наличию развозки и питания", tg:"Аз рӯи ноҳия, навъ, нарх, мавҷудияти расонидан ва ғизо филтр кунед"}},
              {n:"02",icon:Star,t:{ru:"Изучайте рейтинг",tg:"Рейтингро омӯзед"},d:{ru:"Честная оценка по 9 параметрам — от качества обучения до безопасности", tg:"Бақои ростқавлона аз рӯи 9 меъёр — аз сифати таълим то бехатарӣ"}},
              {n:"03",icon:MessageCircle,t:{ru:"Читайте отзывы",tg:"Шарҳҳо хонед"},d:{ru:"Честные мнения родителей и студентов помогут сделать осознанный выбор", tg:"Ақидаҳои ростқавлонаи волидайн ва донишҷӯён ба интихоби огоҳона мадад мерасонанд"}},
              {n:"04",icon:MessageCircle,t:{ru:"Свяжитесь",tg:"Тамос гиред"},d:{ru:"Напишите учреждению напрямую в чате и запишитесь на визит", tg:"Бевосита дар чат ба муассиса нависед ва ба ташриф сабти ном шавед"}},
            ].map((s,i)=>{
              const Icon = s.icon;
              return (
              <div key={s.n} style={{padding:"26px 20px",borderRadius:18,border:`1px solid ${C.border}`,background:C.s1,textAlign:"center",...revealStyle(howVisible,i*80)}}>
                <div style={{width:46,height:46,borderRadius:13,background:`${C.teal}16`,border:`1px solid ${C.teal}33`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
                  <Icon size={20} style={{color:C.teal}}/>
                </div>
                <div style={{fontFamily:FH,fontWeight:900,fontSize:12,color:C.dim,marginBottom:6,letterSpacing:".08em"}}>{t({ru:"ШАГ", tg:"ҚАДАМИ"})} {s.n}</div>
                <p style={{fontFamily:FH,fontWeight:800,fontSize:17,color:C.text,marginBottom:8}}>{t(s.t)}</p>
                <p style={{fontSize:13,color:C.sub,lineHeight:1.6}}>{t(s.d)}</p>
              </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
