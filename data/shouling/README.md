# 壽陵碑額

The sixteen seal-script characters of the title 大白高國護城聖德至懿皇帝壽陵誌文, from
李范文《夏漢字典》 (1997), front plate 「西夏文篆書仁孝陵出土篆額殘碑 / 篆額復原圖」; the 2008
edition prints it at p. 90. The plate pairs the drawing with the Chinese translation
大白高國 / 護城聖德 / 至懿皇帝 / 壽陵志文.

The grid is four columns, read right to left, four characters top to bottom:

| column | characters |
| --- | --- |
| 1 (rightmost) | 大 白 高 國 |
| 2 | 護 城 聖 德 |
| 3 | 至 懿 皇 帝 |
| 4 (leftmost) | 壽 陵 誌 銘 |

The book states no licence. The sixteen crops in `app/public/seal/shouling/` are quoted for
identifying the characters; they are a modern tracing of the broken 碑額, not a facsimile of the
stone. The source page is not committed.

Re-cut them with the page rendered at 300 dpi:

```sh
pdftoppm -f 8 -l 8 -r 300 -png '李范文（1997）『夏漢字典』.pdf' /tmp/xhzd-page
uv run scripts/build_tangut_script_forms.py --page /tmp/xhzd-page-08.png
```
