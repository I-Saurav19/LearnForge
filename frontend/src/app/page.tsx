const features = [
  { number: "01", title: "Bring your materials", text: "Start with the notes and resources you already use." },
  { number: "02", title: "Build understanding", text: "Turn complex subjects into a clear path through the material." },
  { number: "03", title: "Practice with purpose", text: "Check what you know and keep moving forward." },
];

export default function Home() {
  return <main className="min-h-screen overflow-hidden">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 md:px-10">
      <a className="flex items-center gap-3 font-semibold tracking-tight" href="#top" aria-label="LearnForge AI home">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#205c48] text-sm font-bold text-white">LF</span>
        <span>LearnForge <span className="text-[#668071]">AI</span></span>
      </a>
      <nav className="flex items-center gap-3"><a className="px-3 py-2 text-sm font-medium text-[#47715d]" href="/login">Sign in</a><a className="rounded-full bg-[#205c48] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#174a39]" href="/register">Get started</a></nav>
    </header>

    <section id="top" className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 md:grid-cols-[1.05fr_.95fr] md:px-10 md:pb-32 md:pt-20">
      <div className="relative z-10">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8dfd9] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[.16em] text-[#47715d]"><span className="h-2 w-2 rounded-full bg-[#68a47f]" />A clearer way to study</p>
        <h1 className="max-w-2xl text-5xl font-semibold leading-[1.07] tracking-[-.055em] md:text-7xl">Make your study time <span className="text-[#38795d]">count.</span></h1>
        <p className="mt-7 max-w-lg text-lg leading-8 text-[#64716a]">A calmer, more personal way to learn. Bring your materials, find your way through a subject, and build understanding one step at a time.</p>
        <a href="#about" className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#205c48] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#205c48]/15 transition hover:bg-[#174a39]">Explore the approach <span aria-hidden="true">↗</span></a>
      </div>

      <div className="relative mx-auto w-full max-w-xl">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#d8e9d8] blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-[#f0e7cc] blur-3xl" />
        <div className="relative rounded-[2rem] border border-white bg-white/80 p-5 shadow-[0_32px_100px_-45px_rgba(31,72,53,.38)] backdrop-blur md:p-7">
          <div className="flex items-center justify-between border-b border-[#edf0eb] pb-5"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#789080]">Your learning space</p><p className="mt-1 text-lg font-semibold">A little progress, each day</p></div><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eff5ee] text-[#39765b]">✳</span></div>
          <div className="mt-6 rounded-2xl bg-[#f4f7f2] p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Foundations of biology</span><span className="text-xs text-[#718078]">Learning path</span></div><div className="mt-5 space-y-3"><div className="flex items-center gap-3 rounded-xl bg-white p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2f0e5] text-sm text-[#39765b]">✓</span><span className="text-sm">The building blocks of life</span></div><div className="flex items-center gap-3 rounded-xl border border-[#dce6dc] bg-white p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#205c48] text-xs text-white">02</span><span className="text-sm font-medium">How cells work</span><span className="ml-auto text-[#87a291]">→</span></div><div className="flex items-center gap-3 rounded-xl bg-white/70 p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#eff2ed] text-xs text-[#829087]">03</span><span className="text-sm text-[#7b8780]">Energy and living systems</span></div></div></div>
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#edf0eb] p-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f6f0df] text-lg">✦</div><div><p className="text-sm font-semibold">Keep your curiosity close</p><p className="mt-1 text-xs text-[#78847d]">One useful question can open a new idea.</p></div></div>
        </div>
      </div>
    </section>

    <section id="about" className="border-t border-[#e5eae4] bg-white/65 px-6 py-20 md:px-10 md:py-24">
      <div className="mx-auto max-w-7xl"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.17em] text-[#47715d]">Learning, made personal</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] md:text-4xl">A study companion that starts with you.</h2><p className="mt-4 leading-7 text-[#64716a]">LearnForge AI is being built to help students make more sense of the material they already have.</p></div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">{features.map((feature) => <article key={feature.number} className="rounded-2xl border border-[#e7ebe5] bg-white p-6"><p className="text-xs font-semibold tracking-[.14em] text-[#78a087]">{feature.number}</p><h3 className="mt-5 text-lg font-semibold">{feature.title}</h3><p className="mt-2 leading-6 text-[#738078]">{feature.text}</p></article>)}</div>
      </div>
    </section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-7 text-xs text-[#7c8981] md:flex-row md:items-center md:justify-between md:px-10"><span>© 2026 LearnForge AI</span><span>Made for curious minds.</span></footer>
  </main>;
}
