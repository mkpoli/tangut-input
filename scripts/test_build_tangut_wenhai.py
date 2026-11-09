"""Run with: python3 -m unittest discover -s scripts -p test_build_tangut_wenhai.py."""
import unittest

import build_tangut_wenhai as build


class HelpersTest(unittest.TestCase):
    def test_a_position_loses_its_variant_suffix(self):
        self.assertEqual(build.position_key('17.151a'), '17.151')
        self.assertEqual(build.position_key('17.151*'), '17.151')
        self.assertEqual(build.position_key('05.131'), '05.131')

    def test_a_node_keeps_its_reading_suffix_and_names_its_character(self):
        self.assertEqual(build.node_char('𘅇a'), '𘅇')
        self.assertEqual(build.node_char('𘀏'), '𘀏')


def head(position, char, fanqie='', tr='1.01', initial='I-01', rhyme='R-001', ty='I'):
    return {
        'WenhaiPos': position, 'Tangut': char, 'LiFanwen': '', 'Fanqie': fanqie,
        'InitialTY': ty, 'InitialClassID': initial, 'RhymeClassID': rhyme,
        'ToneRhyme': tr, 'Grade': 'I', 'Cycle': 'Major', 'She': '1', 'Subcycle': 'A',
        'GHC': 'pu¹', 'MB': 'pu̠¹',
    }


def group(base, fanqie, governed, members):
    return {
        'FanqieBase': base, 'Fanqie': fanqie, 'Upper': '𗈽', 'Lower': '𗒿',
        'Announced': str(len(governed)), 'Represented': str(len(governed)),
        'Governed positions': ' '.join(governed), 'Members': ' '.join(members),
    }


def chain(graph, identifier, ty, size, anchor, members, evidence=''):
    return {
        'Graph': graph, 'ClassID': identifier, 'TY': ty, 'Status': 'head and upper-speller',
        'Size': str(size), 'Anchor': anchor, 'Members': ' '.join(members),
        'UpperSpellers': '', 'Upper-speller TY evidence': evidence,
    }


class BuildTest(unittest.TestCase):
    def document(self):
        heads = [
            head('05.131', '𘀏', '𗈽𗒿𘈖𗥃'),
            head('05.132', '𘀑'),
            head('05.141', '𗱏', tr='1.02'),
        ]
        groups = [group('05.131', '𗈽𗒿𘈖𗥃', ['05.131', '05.132', '05.141'],
                        ['𘀏', '𘀑', '𗱏'])]
        chains = [
            chain('Initial', 'I-01', 'I', 4, '𘀏', ['𘀏', '𗱏', '𘀑', '𘅇a'], '𗉣=I'),
            chain('Rhyme', 'R-001', '', 3, '𘀏', ['𘀏', '𘀑', '𗱏']),
        ]
        links = [
            {'Graph': 'Initial', 'Relation': 'co-governed', 'ClassID': 'I-01', 'Node': '𘀏',
             'LinkedTo': '𘀑', 'FanqieBase': '05.131', 'GovernedBase': '05.132'},
        ]
        initial_cross = [{'ClassID': 'I-01', 'Chain junction(s)': '05.141: 𘀏 [I] → 𘅇a [II]'}]
        members = [
            {'Graph': 'Initial', 'ClassID': 'I-01', 'Member': member}
            for member in ['𘀏', '𗱏', '𘀑', '𘅇a']
        ] + [
            {'Graph': 'Rhyme', 'ClassID': 'R-001', 'Member': member}
            for member in ['𘀏', '𘀑', '𗱏']
        ]
        return build.build(heads, groups, chains, links, initial_cross, [], [], members)

    def test_every_position_takes_the_statement_that_governs_it(self):
        document = self.document()
        first, second = document['heads'][:2]
        self.assertEqual(first['fanqie'], '𗈽𗒿𘈖𗥃')
        self.assertTrue(first['stated'])
        self.assertEqual(second['fanqie'], '𗈽𗒿𘈖𗥃')
        self.assertFalse(second['stated'])
        self.assertEqual(second['via'], '05.131')

    def test_a_rhyme_chains_tones_come_from_its_head_members(self):
        document = self.document()
        self.assertEqual(document['rhyme'][0]['level'], ['1.01', '1.02'])
        self.assertFalse(document['rhyme'][0]['cross'])
        self.assertEqual(document['rhyme'][0]['other'], [])
        self.assertFalse(document['rhyme'][0]['partial'])

    def test_the_crossing_table_names_the_junction(self):
        document = self.document()
        self.assertTrue(document['initial'][0]['cross'])
        self.assertIn('05.141', document['initial'][0]['junctions'])
        self.assertEqual(document['cross']['initial'], ['I-01'])

    def test_the_links_are_grouped_by_graph_and_chain(self):
        document = self.document()
        self.assertEqual(document['links']['initial']['I-01'],
                         [['𘀏', '𘀑', 'co-governed', '05.131', '05.132']])

    def test_a_member_table_that_disagrees_is_refused(self):
        with self.assertRaises(SystemExit):
            build.build(
                [head('05.131', '𘀏', '𗈽𗒿𘈖𗥃')], [], [chain('Rhyme', 'R-001', '', 1, '𘀏', ['𘀏'])],
                [], [], [], [], [{'Graph': 'Rhyme', 'ClassID': 'R-001', 'Member': '𘀑'}],
            )

    def test_a_reading_specific_node_keeps_its_suffix(self):
        document = self.document()
        self.assertIn('𘅇a', document['initial'][0]['members'])

    def test_the_counts_the_release_states_are_enforced(self):
        document = self.document()
        document['stats']['heads'] = 3
        with self.assertRaises(SystemExit):
            build.check(document)


if __name__ == '__main__':
    unittest.main()
