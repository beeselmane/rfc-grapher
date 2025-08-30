const fs = require('fs/promises');

Array.prototype.popHead = () => {
    if (!this.length) {
        return undefined;
    }

    res = this[0];
    this.splice(0, 1);

    return res;
};

exports = module.exports = {};

// Graph node
exports.Node = function (name, info) {
    this.name = name;
    this.info = info;

    // Pointers from this node
    this.obsoletes = [];
    this.updates = [];

    // Pointers to this node
    this.obsoleted_by = [];
    this.updated_by = [];
};

exports.info = (dir, id) => {
    path = `${dir}/rfc${id}.json`;

    return fs.readFile(path, 'utf8').then((contents) => {
        return JSON.parse(contents);
    }).catch((err) => {
        console.error(`Error reading '${path}':`, err);
        throw err;
    })
};

exports.nodeFrom = (dir, name) => {
    const lower = name.toLowerCase();

    if (!lower.startsWith('rfc')) {
        throw new Error(`bad name '${name}'`);
    }

    // I've found at least one rfc specified with a leading 0, so need to call parseInt.
    return exports.info(dir, parseInt(lower.substring(3))).then((info) => new exports.Node(lower, info));
}

exports.graphFrom = async (dir, name) => {
    try {
        const root = await exports.nodeFrom(dir, name);

        // Node queue. We keep reading nodes until this is empty.
        const queue = [ root.name ];

        // Hash map for lookup. If a node appears here, we've already processeed it.
        const nodes = {};

        // Function to process each array (obsoletes, obsoleted_by, updates, updated_by) for a single node.
        // On `node` map the array `from` to the array `to` on target nodes.
        // Put nodes that don't yet exist in the queue, and fixup links for nodes which do exist.
        const processDeps = (node, from, to) => node.info[from].map((dep) => {
            lower = dep.toLowerCase().trim();
            console.info(`Process ${lower}...`);

            if (lower in nodes) {
                console.info(`${lower}.${to} <-> ${node.name}.${from}`);

                // This dependency already exists.
                node[from].push(nodes[lower]);
                nodes[lower][to].push(node);
            } else {
                console.info(`Queue ${lower} (from ${node.name}.${from})...`);

                // This dependency does not exist.
                queue.push(lower);
            }
        });

        while ((next = queue.pop()) !== undefined) {
            if (next in nodes) {
                continue;
            }

            if (next.startsWith('ien')) {
                console.warn(`Ignoring non-rfc '${next}'...`);
                continue;
            }

            const node = await exports.nodeFrom(dir, next);
            nodes[node.name] = node;

            processDeps(node, 'obsoletes', 'obsoleted_by');
            processDeps(node, 'updates', 'updated_by');

            processDeps(node, 'obsoleted_by', 'obsoletes');
            processDeps(node, 'updated_by', 'updates');
        }

        // Function to check for bidirectional links
        const check = (node, from, to) => node[from].some((obj) => !obj[to].includes(node));

        // Verify all links are bidirectional
        const ok = !Object.values(nodes).some((node) => {
            const obs = check(node, 'obsoletes', 'obsoleted_by');
            const upd = check(node, 'updates', 'updated_by');

            return obs || upd;
        });

        if (!ok) {
            throw new Error('bad linking')
        }

        return nodes;
    } catch (err) {
        console.error('Failed to create graph. Error:', err);
    }
};

exports.toDot = (nodes, highlight) => {
    let dot = '# Auto generated graph for RFC dependency analysis. Meant to be compiled with\n';
    dot += '# sfdp -Tsvg -Gmodel=subset -Goverlap=prism\n';
    dot += 'digraph {\n';

    Object.keys(nodes).forEach((name) => {
        dot += `\t${name}`

        if (highlight?.includes(name)) {
            dot += ' [fillcolor=yellow,style=filled]';
        }

        dot += '\n';
    });

    dot += '\n\tsubgraph updates {\n';
    dot += '\t\tedge [color=green]\n\n';

    Object.values(nodes).forEach((node) => {
        node.updated_by.forEach((upd) => dot += `\t\t${node.name} -> ${upd.name}\n`);
    });

    dot += '\t}\n\n';

    dot += '\tsubgraph obsoletes {\n';
    dot += '\t\tedge [color=red]\n\n';

    Object.values(nodes).forEach((node) => {
        node.obsoleted_by.forEach((obs) => dot += `\t\t${obs.name} -> ${node.name}\n`);
    });

    dot += '\t}\n';

    dot += '}';
    return dot;
};

exports.writeDot = (dot, to) => {
    return fs.writeFile(to, dot);
};

exports.writeDotFor = async (dir, name, to) => {
    nodes = await exports.graphFrom(dir, name);
    dot = exports.toDot(nodes, [ name ]);
    await exports.writeDot(dot, to);
}
