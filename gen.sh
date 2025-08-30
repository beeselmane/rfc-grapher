#!/bin/sh

if [ -z "${1}" ]; then
    echo 'No args!'
    exit 1
fi

# First, ensure the RFC metadata is synced
mkdir -pv json
sh sync.sh

export num=${1}

echo "const rfc = require('./rfc'); rfc.writeDotFor('json', 'rfc${num}', 'rfc${num}.gv').then(() => console.info('Wrote', 'rfc${num}.gv'))" | node --input-type=commonjs || exit 1

sfdp -Tsvg -Gmodel=subset -Goverlap=prism rfc${num}.gv > rfc${num}.svg

