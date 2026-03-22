import fitz
with open('test.svg', 'w') as f:
    f.write('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">Hello World!</text></svg>')

doc = fitz.open('test.svg')
print(doc.page_count)
print(doc[0].get_text('dict'))
