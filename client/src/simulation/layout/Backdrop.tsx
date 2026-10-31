import croOffice from '@/assets/sim/cro-office.webp';
import deskBokeh from '@/assets/sim/desk-bokeh.webp';
import office from '@/assets/sim/office.webp';
import { EASE_OUT, m } from '@/ui/motion';

/** Which office the screen is set in: the Workday 1 study floor, or the Workday 2 CRO desk. */
export type ScenePhoto = 'office' | 'cro';

const HERO: Record<ScenePhoto, string> = { office, cro: croOffice };
const BOKEH: Record<ScenePhoto, string> = { office: deskBokeh, cro: croOffice };

/** Full-bleed office photograph under a copper wash, darkened on the left where the copy sits. */
export function HeroPhoto({ photo }: { photo: ScenePhoto }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#1a1410]">
      <m.img
        src={HERO[photo]}
        alt=""
        className="size-full object-cover object-center"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE_OUT }}
      />
      <div className="absolute inset-0 bg-copper/45" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(16_22_29/0.9)_0%,rgb(22_30_39/0.74)_38%,rgb(26_35_46/0.42)_70%,rgb(26_35_46/0.18)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(14_18_24/0.4)_0%,transparent_18%,transparent_80%,rgb(14_18_24/0.5)_100%)]" />
      {/* Copy spans the full width on small screens, so darken evenly there. */}
      <div className="absolute inset-0 bg-[rgb(16_22_29/0.35)] lg:hidden" />
    </div>
  );
}

/** Soft, out-of-focus office behind centred content, in place of the plain canvas. Needs an `isolate` parent. */
export function SceneBackdrop({ photo = 'office' }: { photo?: ScenePhoto }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <img src={BOKEH[photo]} alt="" className="size-full scale-110 object-cover object-center blur-md" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(250_248_245/0.72),rgb(247_243_239/0.55)_45%,rgb(245_239_235/0.78))]" />
    </div>
  );
}
