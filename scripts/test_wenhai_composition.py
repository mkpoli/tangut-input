"""Run with: python3 -m unittest discover -s scripts -p test_wenhai_composition.py."""
import json
import tempfile
import unittest
from pathlib import Path

import eval_wenhai_composition as wenhai


class FormulaPartsTest(unittest.TestCase):
    def test_the_part_vocabulary_is_the_seven_terms(self):
        self.assertEqual(set(wenhai.PARTS),
                         set('𘓳𘊱𘁝𗡼𗥦𗘡𘍞'))

    def test_source_without_a_term_is_the_whole_character(self):
        self.assertEqual(wenhai.formula_parts('AB'), [('A', 'whole'), ('B', 'whole')])

    def test_a_term_modifies_the_source_before_it(self):
        self.assertEqual(wenhai.formula_parts('A𘊱B𗡼'),
                         [('A', 'left'), ('B', 'right')])

    def test_elided_terms_leave_the_later_source_with_its_part(self):
        self.assertEqual(wenhai.formula_parts('AB𘊱'),
                         [('A', 'whole'), ('B', 'left')])

    def test_elide_marks_a_bare_source_as_none(self):
        self.assertEqual(wenhai.formula_parts('AB', elide=True),
                         [('A', None), ('B', None)])

    def test_a_term_alone_is_rejected(self):
        with self.assertRaises(ValueError):
            wenhai.formula_parts('𘊱A')


class PartTest(unittest.TestCase):
    def setUp(self):
        self.ids = {
            'H': '⿰AB',
            'T': '⿲ABC',
            'V': '⿱AB',
            'W': '⿳ABC',
            'E': '⿴AB',
            'F': '⿵AB',
            'Z': '⿺AB',
            'O': '⿻AB',
            'L': 'A',
        }

    def test_horizontal_parts(self):
        self.assertEqual(wenhai.part_of('H', 'left', self.ids), 'A')
        self.assertEqual(wenhai.part_of('H', 'right', self.ids), 'B')
        self.assertIsNone(wenhai.part_of('H', 'middle', self.ids))
        self.assertEqual(wenhai.part_of('T', 'middle', self.ids), 'B')
        self.assertEqual(wenhai.part_of('T', 'right', self.ids), 'C')

    def test_vertical_parts(self):
        self.assertEqual(wenhai.part_of('V', 'top', self.ids), 'A')
        self.assertEqual(wenhai.part_of('V', 'bottom', self.ids), 'B')
        self.assertEqual(wenhai.part_of('W', 'top', self.ids), 'A')
        self.assertEqual(wenhai.part_of('W', 'middle', self.ids), 'B')
        self.assertEqual(wenhai.part_of('W', 'bottom', self.ids), 'C')
        self.assertIsNone(wenhai.part_of('V', 'left', self.ids))

    def test_surrounding_part(self):
        self.assertEqual(wenhai.part_of('E', 'surrounding', self.ids), 'A')
        self.assertEqual(wenhai.part_of('F', 'surrounding', self.ids), 'A')
        self.assertEqual(wenhai.part_of('Z', 'surrounding', self.ids), 'A')
        self.assertIsNone(wenhai.part_of('O', 'surrounding', self.ids))

    def test_whole_and_missing(self):
        self.assertEqual(wenhai.part_of('H', 'whole', self.ids), '⿰AB')
        self.assertIsNone(wenhai.part_of('M', 'whole', self.ids))
        self.assertIsNone(wenhai.part_of('L', 'left', self.ids))


class TreeTest(unittest.TestCase):
    def test_leaves_and_subtrees(self):
        node = wenhai.ids_top('⿰A⿱BC')
        self.assertEqual(wenhai.ids_leaves(node), ['A', 'B', 'C'])
        self.assertIn('⿱BC', wenhai.ids_subtrees(node))
        self.assertIn('⿰A⿱BC', wenhai.ids_subtrees(node))
        self.assertNotIn('⿱AB', wenhai.ids_subtrees(node))

    def test_a_trailing_character_is_not_one_description(self):
        self.assertIsNone(wenhai.ids_top('⿰AB C'))
        self.assertIsNone(wenhai.ids_top('⿰A'))


class FormulaTableTest(unittest.TestCase):
    def write(self, rows):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        path = Path(folder.name) / 'formulas.jsonl'
        path.write_text('\n'.join(json.dumps(row, ensure_ascii=False) for row in rows) + '\n',
                        encoding='utf-8')
        return path

    def test_reads_rows_and_numbers_a_missing_position(self):
        rows = wenhai.read_formulas(self.write([
            {'position': '1.05.131', 'character': '𘀏', 'formula': '𘀑𘊱𗩝𗡼'},
            {'character': '𘀑', 'formula': '𘀏𘍞𗿼𘊱'},
        ]))
        self.assertEqual(rows[0], {'position': '1.05.131', 'character': '𘀏',
                                   'formula': '𘀑𘊱𗩝𗡼'})
        self.assertEqual(rows[1]['position'], '2')
        self.assertEqual(rows[1]['character'], '𘀑')

    def test_rejects_a_non_tangut_character(self):
        with self.assertRaises(SystemExit):
            wenhai.read_formulas(self.write([
                {'character': 'A', 'formula': '𘀑𘊱𗩝𗡼'},
            ]))

    def test_rejects_a_non_object_line(self):
        with self.assertRaises(SystemExit):
            wenhai.read_formulas(self.write([[]]))

    def test_rejects_a_long_formula(self):
        with self.assertRaises(SystemExit):
            wenhai.read_formulas(self.write([
                {'character': '𘀏', 'formula': '𘀑𘊱𗩝𗡼𘀑'},
            ]))

    def test_the_repository_table_keeps_the_60_rows(self):
        path = Path(__file__).resolve().parents[1] / 'data/wenhai/constructions.jsonl'
        rows = wenhai.read_formulas(path)
        self.assertEqual(len(rows), 60)
        self.assertEqual(rows[0], {'position': '1.05.131', 'character': '𘀏',
                                   'formula': '𘀑𘊱𗩝𗡼'})

    def test_rejects_an_empty_file(self):
        with self.assertRaises(SystemExit):
            wenhai.read_formulas(self.write([]))


class ChoosePartTest(unittest.TestCase):
    def setUp(self):
        self.ids = {
            'S': '⿱A⿰BC',
            'H': '⿰BD',
            'W': '⿱AB',
            'Q': '⿱AB',
        }

    def test_the_top_level_is_tried_first(self):
        ids = {'S': '⿰AB', 'H': '⿰AB'}
        self.assertEqual(wenhai.choose_part('S', 'left', 'H', ids), 'A')

    def test_a_descendant_supplies_a_cut_the_top_level_cannot(self):
        self.assertEqual(wenhai.choose_part('S', 'left', 'H', self.ids), 'B')

    def test_an_elided_term_searches_every_part(self):
        self.assertEqual(wenhai.choose_part('S', None, 'H', self.ids), 'B')

    def test_an_explicit_whole_does_not_search_descendants(self):
        self.assertIsNone(wenhai.choose_part('W', 'whole', 'H', self.ids))

    def test_no_descendant_is_none(self):
        self.assertIsNone(wenhai.choose_part('Q', 'surrounding', 'H', self.ids))


class GlyphTest(unittest.TestCase):
    def test_exact_lettered_and_two_number_glyphs(self):
        numbers = {'g': ['123'], 'h': ['5150B'], 'i': ['1493', '1505']}
        chars = {'123': 'X', '5150': 'Y', '1493': 'A', '1505': 'B'}
        self.assertEqual(wenhai.glyph_characters('g', numbers, chars), ['X'])
        self.assertEqual(wenhai.glyph_characters('h', numbers, chars), ['Y'])
        self.assertEqual(wenhai.glyph_characters('i', numbers, chars), ['A', 'B'])
        self.assertEqual(wenhai.glyph_characters('z', numbers, chars), [])


if __name__ == '__main__':
    unittest.main()
