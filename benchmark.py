import os
import zipfile
import json
import time
import tempfile
import shutil
import fitz
from pathlib import Path
from dotenv import load_dotenv
from sarvamai import SarvamAI

load_dotenv()

PDF_PATH = "hastyayurveda.pdf"
OUTPUT_DIR = Path("benchmark_output")
OUTPUT_DIR.mkdir(exist_ok=True)

client = SarvamAI(api_subscription_key=os.environ["SARVAM_API_KEY"])

doc = fitz.open(PDF_PATH)
total_pages = len(doc)
print(f"Total pages in PDF: {total_pages}")

# Pick 50 pages spread evenly across the document
step = total_pages // 50
target_pages = [i * step for i in range(50)]
print(f"Sampling pages: {target_pages}\n")

# Split into batches of 10 (Sarvam API limit)
batches = [target_pages[i:i+10] for i in range(0, len(target_pages), 10)]

for batch_num, batch in enumerate(batches):
    print(f"--- Batch {batch_num + 1}/5 | Pages {batch} ---")

    tmp_dir = tempfile.mkdtemp()
    image_paths = []

    for page_num in batch:
        page = doc[page_num]
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom = ~144 DPI, good quality
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
        img_path = os.path.join(tmp_dir, f"page_{page_num:04d}.png")
        pix.save(img_path)
        image_paths.append(img_path)

    # Zip the batch
    zip_path = os.path.join(tmp_dir, f"batch_{batch_num}.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for img_path in image_paths:
            zf.write(img_path, os.path.basename(img_path))

    # Submit to Sarvam
    try:
        job = client.document_intelligence.create_job(
            language="sa-IN",
            output_format="md"
        )
        job.upload_file(zip_path)
        job.start()
        print(f"  Job submitted. Waiting...")
        status = job.wait_until_complete()
        print(f"  Status: {status.job_state}")

        # Download output
        zip_out = str(OUTPUT_DIR / f"batch_{batch_num}_output.zip")
        job.download_output(zip_out)

        # Unzip and save results
        batch_out_dir = OUTPUT_DIR / f"batch_{batch_num}"
        batch_out_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(zip_out, "r") as zf:
            zf.extractall(batch_out_dir)

        # Print a preview of what came back
        for md_file in batch_out_dir.rglob("*.md"):
            print(f"\n  Preview of {md_file.name}:")
            content = md_file.read_text(encoding="utf-8")
            print(content[:500])
            print("  ...")

        metrics = job.get_page_metrics()
        print(f"\n  Pages succeeded: {metrics['pages_succeeded']} / {metrics['pages_processed']}")

    except Exception as e:
        print(f"  ERROR in batch {batch_num}: {e}")

    finally:
        shutil.rmtree(tmp_dir)

    print(f"\n  Sleeping 10s before next batch...\n")
    time.sleep(10)

print("\nDone. All output saved to ./benchmark_output/")