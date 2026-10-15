import type { Law, RegionRule } from './types'

const france = ['FR', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF']

/** Each law's regions and its rule before a choice. */
const lawRules: Record<Law, [regions: string[], rule: RegionRule]> = {
  gdpr: [
    [
      ...'AT BE BG CY CZ DE DK EE ES FI GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK IS LI NO AX'.split(' '),
      ...france,
    ],
    {},
  ],
  uk: [['GB'], {}],
  lgpd: [['BR'], {}],
  quebec: [['CA-QC'], {}],
  cnil: [france, { maxAgeDays: 180 }],
  revfadp: [['CH'], { granted: ['preferences', 'analytics'] }],
  ccpa: [['US'], { granted: 'all', banner: false }],
}

/** The laws on by default. */
const defaultLaws: Partial<Record<Law, boolean>> = { gdpr: true, cnil: true, revfadp: true, ccpa: true }

/** The region rules of the laws switched on in `laws`, merged over `defaultLaws`. */
export function lawRegions(laws: Partial<Record<Law, boolean>> = {}) {
  const regions: Record<string, RegionRule> = {}
  for (const [law, [codes]] of Object.entries(lawRules) as [Law, (typeof lawRules)[Law]][]) {
    if ({ ...defaultLaws, ...laws }[law])
      for (const code of codes) regions[code] = { laws: [...(regions[code]?.laws ?? []), law] }
  }
  return regions
}

/** `rule` over its laws' rules, the stricter one winning: the fewest categories granted, the banner and the shortest re-ask. */
export function resolveRule(rule: RegionRule): RegionRule {
  const merged = (rule.laws ?? []).reduce<RegionRule>((stricter, law, index) => {
    const next = lawRules[law][1]
    const granted = (a: RegionRule['granted'], b: RegionRule['granted']) =>
      a === 'all' ? b : b === 'all' ? a : a && b?.filter((category) => a.includes(category))
    const days = Math.min(stricter.maxAgeDays ?? Infinity, next.maxAgeDays ?? Infinity)
    return {
      granted: index ? granted(stricter.granted, next.granted) : next.granted,
      banner: index ? (stricter.banner === false && next.banner === false ? false : undefined) : next.banner,
      maxAgeDays: days === Infinity ? undefined : days,
    }
  }, {})
  return { ...merged, ...rule }
}

/** Canada outside Quebec: every category granted before a choice, with the banner as notice. Quebec stays opt-in. */
export const canadaRegions: Record<string, RegionRule> = {
  CA: { granted: 'all' },
  'CA-QC': { laws: ['quebec'] },
}

/** The UK's exception for analytics used only for statistics: analytics granted before a choice, with the banner. */
export const ukStatisticsRegions: Record<string, RegionRule> = {
  GB: { granted: ['analytics'], laws: ['uk'] },
}
