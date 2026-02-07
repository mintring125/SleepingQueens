"""
Card Image Processor for Sleeping Queens
사용법:
1. assets/images/cards/raw 폴더에 원본 카드 이미지 저장
2. 이 스크립트 실행: python process_cards.py
3. 처리된 이미지는 assets/images/cards/processed 폴더에 저장됨
"""

from PIL import Image
import os

# Settings
TARGET_WIDTH = 180
TARGET_HEIGHT = 252  # 5:7 ratio (standard card ratio)
RAW_DIR = "assets/images/cards/raw"
OUTPUT_DIR = "assets/images/cards/processed"

def process_card_image(input_path, output_path):
    """Process a single card image: auto-crop and resize"""
    try:
        img = Image.open(input_path)
        
        # Convert to RGBA if needed
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get bounding box of non-transparent content
        bbox = img.getbbox()
        if bbox:
            # Add small padding (5px)
            padding = 5
            bbox = (
                max(0, bbox[0] - padding),
                max(0, bbox[1] - padding),
                min(img.width, bbox[2] + padding),
                min(img.height, bbox[3] + padding)
            )
            img = img.crop(bbox)
        
        # Calculate aspect ratio
        aspect = img.width / img.height
        target_aspect = TARGET_WIDTH / TARGET_HEIGHT
        
        if aspect > target_aspect:
            # Image is wider - crop sides
            new_width = int(img.height * target_aspect)
            left = (img.width - new_width) // 2
            img = img.crop((left, 0, left + new_width, img.height))
        else:
            # Image is taller - crop top/bottom
            new_height = int(img.width / target_aspect)
            top = (img.height - new_height) // 2
            img = img.crop((0, top, img.width, top + new_height))
        
        # Resize to target dimensions
        img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)
        
        # Save as PNG
        output_path = output_path.rsplit('.', 1)[0] + '.png'
        img.save(output_path, 'PNG', optimize=True)
        print(f"✓ Processed: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {input_path}: {e}")
        return False

def main():
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Get all image files in raw directory
    supported_formats = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')
    
    if not os.path.exists(RAW_DIR):
        print(f"Raw directory not found: {RAW_DIR}")
        print("Please create the directory and add card images.")
        return
    
    files = [f for f in os.listdir(RAW_DIR) if f.lower().endswith(supported_formats)]
    
    if not files:
        print(f"No image files found in {RAW_DIR}")
        print("Supported formats:", supported_formats)
        return
    
    print(f"Found {len(files)} images to process...")
    print(f"Target size: {TARGET_WIDTH}x{TARGET_HEIGHT}px")
    print("-" * 40)
    
    success_count = 0
    for filename in files:
        input_path = os.path.join(RAW_DIR, filename)
        output_path = os.path.join(OUTPUT_DIR, filename)
        if process_card_image(input_path, output_path):
            success_count += 1
    
    print("-" * 40)
    print(f"Completed: {success_count}/{len(files)} images processed")
    print(f"Output directory: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
