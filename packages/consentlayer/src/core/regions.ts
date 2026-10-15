import type { RegionRule } from './types'

/** Every category granted before a choice and no banner: the US state laws' opt-out model. */
const optOut: RegionRule = { granted: 'all', banner: false }

/** The rules on by default. Every other region, including the EU, the EEA and the UK, gets the opt-in rule `{}`. */
export const defaultRegions: Record<string, RegionRule> = {
  US: optOut,
  CH: { granted: ['preferences', 'analytics'] },
  FR: { maxAgeDays: 180 },
}

/** Canada outside Quebec: every category granted before a choice, with the banner as notice. Quebec stays opt-in. */
export const canadaRegions: Record<string, RegionRule> = {
  CA: { granted: 'all' },
  'CA-QC': {},
}

/** The UK's exception for analytics used only for statistics: analytics granted before a choice, with the banner. */
export const ukStatisticsRegions: Record<string, RegionRule> = {
  GB: { granted: ['analytics'] },
}
