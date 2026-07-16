from PIL import Image, ImageDraw, ImageFont
import os

os.makedirs('icons', exist_ok=True)

for size in [16, 48, 128]:
    img = Image.new('RGBA', (size, size), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = size // 8
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=size // 5,
        fill='#FFA116'
    )

    if size >= 48:
        font_size = size // 2
        try:
            font = ImageFont.truetype('arial.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), 'L', font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (size - tw) // 2 - bbox[0]
        y = (size - th) // 2 - bbox[1]
        draw.text((x, y), 'L', fill='#000000', font=font)

    img.save(f'icons/icon{size}.png')
    print(f'Created icons/icon{size}.png')

print('All icons generated successfully!')
