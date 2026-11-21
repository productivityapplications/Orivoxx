"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import timeline from "./timeline.json";

const ACCENT = "#17CF97";
const TEXT = "#E1E1DB";
const MUTED = "#8C8C85";
const PANEL = "#111110";
const BORDER = "#282825";

type SceneId = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

const metrics = [
  ["Steps", "24"],
  ["Tool calls", "14"],
  ["Tool errors", "0%"],
  ["Tokens", "20,522"],
  ["Cost", "$0.1129"],
  ["Duration", "47.8s"],
];

const gates = ["cloned", "installs", "fails at base", "deterministic ×3", "time bounded", "license"];

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.span
        className="rounded-full"
        style={{
          width: small ? 10 : 14,
          height: small ? 10 : 14,
          background: ACCENT,
          boxShadow: `0 0 24px ${ACCENT}`,
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="font-mono uppercase tracking-[0.32em]"
        style={{ color: TEXT, fontSize: small ? 11 : 13 }}
      >
        Orivoxx
      </span>
    </div>
  );
}

function Orb() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 760,
          height: 760,
          left: "50%",
          top: "48%",
          marginLeft: -380,
          marginTop: -380,
          background: `radial-gradient(circle, rgba(23,207,151,0.26) 0%, rgba(23,207,151,0.08) 42%, rgba(11,11,9,0) 72%)`,
          filter: "blur(12px)",
        }}
        animate={{ x: [-80, 70, -40, -80], y: [-40, 30, 80, -40], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 420,
          height: 420,
          right: "8%",
          bottom: "4%",
          background: `radial-gradient(circle, rgba(23,207,151,0.16) 0%, rgba(11,11,9,0) 68%)`,
          filter: "blur(20px)",
        }}
        animate={{ x: [30, -60, 20, 30], y: [20, -40, 10, 20], scale: [1, 1.2, 0.9, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(225,225,219,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(225,225,219,0.08) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage: "radial-gradient(circle at 50% 45%, black 0%, transparent 72%)",
        }}
      />
    </div>
  );
}

function BrowserMockup({
  source,
  url,
  zoom = 1,
  focus = "center",
  overlay,
}: {
  source: string;
  url: string;
  zoom?: number;
  focus?: string;
  overlay?: React.ReactNode;
}) {
  return (
    <motion.div
      className="relative w-full overflow-hidden rounded-[20px] border shadow-2xl"
      style={{
        borderColor: BORDER,
        background: PANEL,
        transformOrigin: focus,
        boxShadow: "0 50px 120px rgba(0,0,0,0.62), 0 0 80px rgba(23,207,151,0.06)",
      }}
      animate={{ scale: zoom }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="flex items-center gap-4 border-b px-5 py-3"
        style={{ borderColor: BORDER, background: "#151513" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: "#FF5F57" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#FEBC2E" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#28C840" }} />
        </div>
        <div
          className="flex-1 rounded-md border px-3 py-1.5 font-mono text-[11px]"
          style={{ borderColor: BORDER, color: MUTED, background: "#0D0D0C" }}
        >
          {url}
        </div>
        <span className="font-mono text-[10px]" style={{ color: MUTED }}>
          LIVE
        </span>
      </div>
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
        <video
          key={source}
          className="h-full w-full object-cover"
          src={source}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        {overlay}
      </div>
    </motion.div>
  );
}

function Typewriter({ text, active }: { text: string; active: boolean }) {
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => {
      setLength((value) => {
        if (value >= text.length) {
          clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [active, text]);

  return (
    <span>
      {text.slice(0, length)}
      <span style={{ opacity: 0 }}>{text.slice(length)}</span>
    </span>
  );
}

function Scene({
  id,
  eyebrow,
  title,
  body,
  children,
  align = "left",
}: {
  id: SceneId;
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <motion.section
      key={id}
      className="absolute inset-0 flex items-center"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      data-promo-scene={id}
    >
      <div className={`mx-auto w-full max-w-[1560px] px-16 ${align === "center" ? "text-center" : ""}`}>
        <div className={align === "center" ? "mx-auto max-w-[1100px]" : "grid gap-14 lg:grid-cols-[0.82fr_1.18fr] items-center"}>
          <div>
            <motion.p
              className="font-mono text-[12px] uppercase tracking-[0.34em]"
              style={{ color: ACCENT }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              {eyebrow}
            </motion.p>
            <motion.h1
              className="mt-6 leading-[0.98]"
              style={{
                fontFamily: "var(--font-instrument), serif",
                color: TEXT,
                fontSize: align === "center" ? "clamp(64px, 7vw, 104px)" : "clamp(48px, 5.2vw, 82px)",
                letterSpacing: "-0.03em",
              }}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.75 }}
            >
              {title}
            </motion.h1>
            {body === undefined ? null : (
              <motion.div
                className="mt-7 max-w-[640px] text-[17px] leading-8"
                style={{ color: MUTED }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, duration: 0.7 }}
              >
                {body}
              </motion.div>
            )}
          </div>
          {children}
        </div>
      </div>
    </motion.section>
  );
}

export default function PromoPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);

  const active = timeline.scenes
    .filter((scene) => time >= scene.start)
    .at(-1)?.id as SceneId | undefined;
  const startOf = (id: string) =>
    timeline.scenes.find((scene) => scene.id === id)?.start ?? 0;
  const intro = started && time < timeline.introSeconds;
  const black = started && time < 0.55;

  useEffect(() => {
    if (!started || startRef.current === null) return;
    const startedAt = startRef.current;
    const timer = setInterval(() => {
      setTime((performance.now() - startedAt) / 1000);
    }, 50);
    return () => clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (active !== "06") {
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / 4200);
      setScore(Math.round(progress * 1000) / 10);
      if (progress >= 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [active]);

  function play() {
    startRef.current = performance.now();
    setStarted(true);
    void audioRef.current?.play();
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "#0B0B09", color: TEXT }}
    >
      <audio
        ref={audioRef}
        src="/demo/promo-audio.mp3"
        preload="auto"
        onEnded={() => setFinished(true)}
      />
      <Orb />

      {!started ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            background: "radial-gradient(circle at 50% 45%, rgba(23,207,151,0.12), rgba(11,11,9,0.98) 55%)",
          }}
        >
          <Wordmark />
          <h1
            className="mt-10 max-w-[900px] text-center leading-[0.98]"
            style={{ fontFamily: "var(--font-instrument), serif", fontSize: 82, letterSpacing: "-0.03em" }}
          >
            Benchmark the agent,
            <br />
            not just the model.
          </h1>
          <motion.button
            id="promo-play"
            onClick={play}
            className="mt-12 rounded-full px-9 py-4 font-mono text-[12px] uppercase tracking-[0.24em]"
            style={{ background: ACCENT, color: "#0B0B09" }}
            animate={{ scale: [1, 1.04, 1], boxShadow: [`0 0 0 rgba(23,207,151,0)`, `0 0 40px rgba(23,207,151,0.45)`, `0 0 0 rgba(23,207,151,0)`] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            Play the film
          </motion.button>
          <p className="mt-5 font-mono text-[11px]" style={{ color: MUTED }}>
            2:10 · 1920 × 1080 · deterministic proof
          </p>
        </div>
      ) : null}

      {black ? <div className="absolute inset-0" style={{ background: "#000" }} /> : null}

      {intro && !black ? (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            style={{ width: 18, height: 18, borderRadius: 999, background: ACCENT, boxShadow: `0 0 80px ${ACCENT}` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          <motion.p
            className="mt-8 font-mono text-[13px] uppercase tracking-[0.5em]"
            style={{ color: TEXT }}
            initial={{ opacity: 0, letterSpacing: "0.8em" }}
            animate={{ opacity: 1, letterSpacing: "0.5em" }}
            transition={{ duration: 0.9 }}
          >
            Orivoxx
          </motion.p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: MUTED }}>
            agent benchmark · failure attribution
          </p>
        </motion.div>
      ) : null}

      <AnimatePresence mode="sync">
        {active === "01" ? (
          <Scene
            id="01"
            eyebrow="01 · The problem"
            title={
              <>
                AI agents fail.
                <br />
                You don&apos;t know <em style={{ color: ACCENT }}>why</em>.
              </>
            }
            body={
              <>
                A trace shows forty-seven hand-offs. It does not say whether the model, the harness,
                a tool, or the specification broke.
              </>
            }
            align="center"
          />
        ) : null}

        {active === "02" ? (
          <Scene
            id="02"
            eyebrow="02 · The solution"
            title={
              <>
                Orivoxx.
                <br />
                Deterministic
                <br />
                failure attribution.
              </>
            }
            body="A real repository task, a sandboxed run, and a static score with no model in the loop. Then one intervention proves the diagnosis."
          >
            <BrowserMockup source="/demo/raw-01.webm" url="orivoxx.vercel.app/tasks" />
          </Scene>
        ) : null}

        {active === "03" ? (
          <Scene
            id="03"
            eyebrow="03 · What it measures"
            title={
              <>
                Six metrics.
                <br />
                Four faults.
                <br />
                One profile.
              </>
            }
            body="Steps, tool calls, errors, tokens, cost, and duration. Inject failing tools, latency, context pressure, or a single tool error."
          >
            <div className="grid grid-cols-3 gap-3">
              {metrics.map(([label, value], index) => (
                <motion.div
                  key={label}
                  className="rounded-[14px] border p-5"
                  style={{ borderColor: BORDER, background: PANEL }}
                  initial={{ opacity: 0, y: 26, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.15 + index * 0.11, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>{label}</p>
                  <p className="mt-3 font-mono text-[25px]" style={{ color: TEXT }}>{value}</p>
                </motion.div>
              ))}
            </div>
          </Scene>
        ) : null}

        {active === "04" ? (
          <Scene
            id="04"
            eyebrow="04 · A real run"
            title={
              <>
                Real tasks.
                <br />
                Real tests.
              </>
            }
            body="Claude Code edits the runtime and the type declaration. The test command stays hidden. The harness runs it inside the sandbox."
          >
            <BrowserMockup
              source={time - startOf("04") < 7.4 ? "/demo/raw-01.webm" : "/demo/raw-02.webm"}
              url="orivoxx.vercel.app/tasks/slugify-max-length"
              focus="50% 50%"
              overlay={
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.78))" }}>
                  <span className="font-mono text-[11px]" style={{ color: TEXT }}>slugify-max-length · MIT</span>
                  <span className="rounded-full px-3 py-1 font-mono text-[10px]" style={{ background: "rgba(23,207,151,0.16)", color: ACCENT }}>test PASS</span>
                </div>
              }
            />
          </Scene>
        ) : null}

        {active === "05" ? (
          <Scene
            id="05"
            eyebrow="05 · Attribution"
            title={
              <span style={{ fontSize: "clamp(54px, 6vw, 94px)" }}>
                <Typewriter text="Harness × Recovery." active={active === "05"} />
              </span>
            }
            body="Step 2. The multi-file apply_patch is intercepted with EIO, and the harness never retries. One cell. One rule. One recorded step."
          >
            <BrowserMockup
              source={time - startOf("05") < 3.2 ? "/demo/raw-03.webm" : "/demo/raw-04.webm"}
              url="orivoxx.vercel.app/results/res_c1ba8d7b"
              zoom={1.2}
              focus="50% 78%"
              overlay={
                <div className="absolute bottom-0 left-0 right-0 px-5 py-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.82))" }}>
                  <p className="font-mono text-[11px]" style={{ color: ACCENT }}>patch_apply_failed_unhandled · step 2</p>
                </div>
              }
            />
          </Scene>
        ) : null}

        {active === "06" ? (
          <Scene
            id="06"
            eyebrow="06 · Replay proof"
            title={
              <>
                The diagnosis
                <br />
                is provable.
              </>
            }
            body="The workspace is reconstructed, the intercepted action is applied, dependencies are reinstalled, and the real test command runs again."
          >
            <div className="relative">
              <BrowserMockup
                source="/demo/raw-05.webm"
                url="orivoxx.vercel.app/replay/res_c1ba8d7b"
              />
              <motion.div
                className="absolute -right-6 -top-10 rounded-[18px] border px-7 py-5 text-right"
                style={{ borderColor: "rgba(23,207,151,0.45)", background: "rgba(11,11,9,0.92)", boxShadow: "0 20px 80px rgba(23,207,151,0.18)" }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>counterfactual</p>
                <p className="mt-1 font-mono text-[58px] leading-none" style={{ color: TEXT }}>{score.toFixed(1)}</p>
                <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full" style={{ background: "#242422" }}>
                  <div className="h-full rounded-full" style={{ width: `${score}%`, background: ACCENT }} />
                </div>
                <p className="mt-2 font-mono text-[10px]" style={{ color: MUTED }}>0.0 → 100.0 · PASS</p>
              </motion.div>
            </div>
          </Scene>
        ) : null}

        {active === "07" ? (
          <Scene
            id="07"
            eyebrow="07 · Community"
            title={
              <>
                Bring your
                <br />
                own tasks.
              </>
            }
            body="Submit a GitHub issue, a base commit, and one test command. Six mechanical gates run in the same sandbox. A curator promotes it."
            align="center"
          >
            <div className="mt-10 grid grid-cols-3 gap-3">
              {gates.map((gate, index) => (
                <motion.div
                  key={gate}
                  className="rounded-full border px-5 py-3 font-mono text-[11px]"
                  style={{ borderColor: "rgba(23,207,151,0.28)", color: TEXT, background: "rgba(23,207,151,0.05)" }}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.09, duration: 0.45 }}
                >
                  <span style={{ color: ACCENT }}>✓</span> {gate}
                </motion.div>
              ))}
            </div>
          </Scene>
        ) : null}

        {active === "08" ? (
          <Scene
            id="08"
            eyebrow="08 · Orivoxx"
            title={
              <>
                Benchmark the agent,
                <br />
                not just the model.
              </>
            }
            body={
              <span className="font-mono" style={{ color: ACCENT }}>
                orivoxx.vercel.app
              </span>
            }
            align="center"
          >
            <motion.div
              className="mt-12 flex items-center justify-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              <Wordmark small />
            </motion.div>
          </Scene>
        ) : null}
      </AnimatePresence>

      {started ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.28em]" style={{ color: "rgba(140,140,133,0.55)" }}>
          {finished ? "proof · 0.0 → 100.0" : "orivoxx · deterministic attribution"}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-6 top-6 opacity-60">
        {started ? <Wordmark small /> : null}
      </div>
    </main>
  );
}
