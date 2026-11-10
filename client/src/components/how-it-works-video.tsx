import {useEffect,useRef} from 'react';

export function HowItWorksVideo() {
  const video=useRef<HTMLVideoElement>(null);
  useEffect(()=> {
    const el=video.current;if(!el)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const io=new IntersectionObserver(([entry])=> {
      if(!entry.isIntersecting)return;
      for(const source of el.querySelectorAll('source')) {
        const src=source.dataset.src;if(src&&!source.getAttribute('src'))source.src=src;
      }
      el.load();
      if(!reduced.matches)void el.play();
      io.disconnect();
    },{rootMargin:'200px'});
    io.observe(el);
    const onReduce=()=> {if(reduced.matches)el.pause();};
    reduced.addEventListener('change',onReduce);
    return()=> {io.disconnect();reduced.removeEventListener('change',onReduce);};
  },[]);
  return (
    <video
      ref={video}
      className="how-it-works-video"
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      poster="/how-it-works.jpg"
      width={390}
      height={844}
      aria-label="How SkyHedge weather hedging works on Devnet: a funded demo wallet, a Toronto market trade, and how settlement is checked"
    >
      <source data-src="/how-it-works.webm" type="video/webm" />
      <source data-src="/how-it-works.mp4" type="video/mp4" />
    </video>
  );
}

export function HowItWorksSection() {
  return (
    <section className="how-it-works section reveal" id="how-it-works" aria-labelledby="how-it-works-title">
      <div className="how-it-works-copy">
        <span className="eyebrow">How it works</span>
        <h2 id="how-it-works-title">See a real pass through the app.</h2>
        <p className="section-lead">Weather hedging for anyone. This is a recorded Devnet session: a demo wallet is funded in one step, a Toronto total-precipitation market is traded, and settlement is checked with Environment Canada, plus an earlier example settled with NOAA.</p>
        <p className="how-it-works-note">About 30 seconds. Play money on Devnet. Muted and looping.</p>
        <a className="text-action" href="/app">Open the app</a>
      </div>
      <div className="how-it-works-stage">
        <HowItWorksVideo />
      </div>
    </section>
  );
}
