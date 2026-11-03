"""Run with: python3 -m unittest discover -s scripts -p test_build_wenhai_composition.py."""
import json
import tempfile
import unittest
from pathlib import Path

import build_wenhai_composition as build


class PartsTest(unittest.TestCase):
    def test_a_term_modifies_the_source_before_it(self):
        self.assertEqual(build.card_parts('𘀑𘊱𗩝𗡼'),
                         [['𘀑', 'left'], ['𗩝', 'right']])

    def test_a_bare_source_keeps_a_null_part(self):
        self.assertEqual(build.card_parts('𗷼𗦮𗛮𘊱'),
                         [['𗷼', None], ['𗦮', None], ['𗛮', 'left']])

    def test_an_explicit_whole_stays_whole(self):
        self.assertEqual(build.card_parts('𘀈𘓳𗰞𗡼'),
                         [['𘀈', 'whole'], ['𗰞', 'right']])

    def test_a_term_alone_is_rejected(self):
        with self.assertRaises(ValueError):
            build.card_parts('𘊱𘀑')


class DocumentTest(unittest.TestCase):
    def test_a_table_row_becomes_an_entry(self):
        document = build.from_table([
            {'position': '1.05.131', 'character': '𘀏', 'formula': '𘀑𘊱𗩝𗡼'},
        ], 'a table')
        self.assertEqual(document['source'], 'a table')
        self.assertEqual(document['entries'], {
            '𘀏': {'position': '1.05.131', 'parts': [['𘀑', 'left'], ['𗩝', 'right']]},
        })

    def test_a_duplicate_head_is_rejected(self):
        with self.assertRaises(SystemExit):
            build.from_table([
                {'position': '1', 'character': '𘀏', 'formula': '𘀑𘊱𗩝𗡼'},
                {'position': '2', 'character': '𘀏', 'formula': '𘀏𘍞𗿼𘊱'},
            ], 'a table')

    def test_a_bad_table_formula_names_the_character(self):
        with self.assertRaises(SystemExit):
            build.from_table([
                {'position': '1', 'character': '𘀏', 'formula': '𘊱𘀑'},
            ], 'a table')

    def test_write_round_trips(self):
        document = build.from_table([
            {'position': '1.05.131', 'character': '𘀏', 'formula': '𘀑𘊱𗩝𗡼'},
        ], 'a table')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'data.json'
            build.write(document, path)
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')), document)


if __name__ == '__main__':
    unittest.main()
