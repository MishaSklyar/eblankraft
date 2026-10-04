"""Load collision and navigation from the same imported voxels as the browser."""
import json
from pathlib import Path
from collections import defaultdict


def load_eblan2():
    source = (Path(__file__).parent / 'js/de_eblan2.js').read_text()
    data = json.loads(source[source.index('{"id"'):].rstrip(';\n'))
    columns = defaultdict(set)
    for key, pairs in data['chunks'].items():
        cx, cz = map(int, key.split(','))
        for index, block in zip(pairs[::2], pairs[1::2]):
            if block:
                columns[cx * 16 + index % 16, cz * 16 + index // 512].add(index // 16 % 32)
    boxes, spatial, nav = [], {}, {}
    for (x, z), levels in columns.items():
        runs = []
        for y in sorted(levels):
            if runs and runs[-1][4] == y: runs[-1][4] = y + 1
            else: runs.append([x, y, z, x + 1, y + 1, z + 1])
            if y + 1 not in levels and y + 2 not in levels:
                nav[x, y + 1, z] = True
        spatial[x, z] = runs
        boxes.extend(runs)
    def point(x, z):
        node = min(nav, key=lambda n: (n[0]-x)**2 + (n[2]-z)**2 + max(0, n[1]-12)**2 * 4)
        return [node[0] + .5, node[1], node[2] + .5]
    sites = {'A': point(45, -40), 'B': point(-50, -40)}
    spawns = {team: [point(x + offset, z) for offset in (-2, 0, 2)]
              for team, (x, z) in {'T': (0, 55), 'CT': (0, 20)}.items()}
    return ({'id': 'de_eblan2', 'floorY': 0, 'min': -85, 'max': 85,
             'wallHeight': 0, 'movement': 'bhop', 'obstacles': boxes,
             'sites': {name: [p[0], p[2]] for name, p in sites.items()},
             'siteHeights': {name: p[1] for name, p in sites.items()}, 'spawns': spawns}, spatial, nav)


EBLAN2_MAP, EBLAN2_COLUMNS, EBLAN2_NAV = load_eblan2()
