# Codelash Field CRM — website preview

Staging copy of the Codelash Field CRM marketing site, served by GitHub Pages at
https://zachariahvk.github.io/fieldcrm/

Every page carries `noindex`: the production home is codelash.com/fieldcrm/, and canonical URLs already point there.
Source and build scripts live outside this repo (`fieldcrm-v2`, built with `FIELDCRM_PREVIEW=1 python build.py && node og.mjs`); this repo holds only the built output.
