"""
Generate a sample certificate PDF and CSV for testing.
"""
import fitz  # PyMuPDF

def create_sample_certificate():
    doc = fitz.open()
    page = doc.new_page(width=842, height=595)  # A4 landscape

    # Background - light cream
    page.draw_rect(page.rect, color=None, fill=(0.98, 0.96, 0.92))

    # Border
    border = fitz.Rect(30, 30, 812, 565)
    page.draw_rect(border, color=(0.6, 0.5, 0.3), width=2)
    inner_border = fitz.Rect(35, 35, 807, 560)
    page.draw_rect(inner_border, color=(0.7, 0.6, 0.4), width=0.5)

    # Title
    page.insert_text(
        point=(421, 100),
        text="Certificate of Achievement",
        fontname="helv",
        fontsize=32,
        color=(0.2, 0.15, 0.1),
    )

    # Subtitle
    page.insert_text(
        point=(421, 150),
        text="This is to certify that",
        fontname="helv",
        fontsize=14,
        color=(0.4, 0.35, 0.3),
    )

    # Name placeholder
    page.insert_text(
        point=(421, 210),
        text="Recipient Name",
        fontname="helv",
        fontsize=28,
        color=(0.15, 0.1, 0.4),
    )

    # Achievement text
    page.insert_text(
        point=(421, 270),
        text="has successfully completed the course",
        fontname="helv",
        fontsize=14,
        color=(0.4, 0.35, 0.3),
    )

    # Course name placeholder
    page.insert_text(
        point=(421, 320),
        text="Course Title",
        fontname="helv",
        fontsize=22,
        color=(0.15, 0.1, 0.4),
    )

    # Date
    page.insert_text(
        point=(421, 390),
        text="Date: March 5, 2026",
        fontname="helv",
        fontsize=12,
        color=(0.4, 0.35, 0.3),
    )

    # Signature line
    page.draw_line(fitz.Point(300, 480), fitz.Point(542, 480), color=(0.4, 0.35, 0.3), width=0.5)
    page.insert_text(
        point=(421, 500),
        text="Director of Education",
        fontname="helv",
        fontsize=11,
        color=(0.4, 0.35, 0.3),
    )

    doc.save("test_certificate.pdf")
    doc.close()
    print("Created test_certificate.pdf")


def create_sample_csv():
    import csv
    data = [
        {"Name": "Aarav Shah", "Course": "Advanced Python Programming", "Date": "March 5, 2026"},
        {"Name": "Priya Sharma", "Course": "Machine Learning Fundamentals", "Date": "March 5, 2026"},
        {"Name": "Rahul Kumar", "Course": "Web Development Bootcamp", "Date": "March 5, 2026"},
        {"Name": "Ananya Patel", "Course": "Data Science with R", "Date": "March 5, 2026"},
        {"Name": "Vikram Singh", "Course": "Cloud Architecture", "Date": "March 5, 2026"},
    ]

    with open("test_data.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Name", "Course", "Date"])
        writer.writeheader()
        writer.writerows(data)

    print("Created test_data.csv")


if __name__ == "__main__":
    create_sample_certificate()
    create_sample_csv()
