#!/usr/bin/env python3
"""
Regenerate ALL favicon/icon files from the 3Boxes HRMS logo.
This ensures every browser tab, PWA icon, Apple touch icon, and splash screen
shows the 3Boxes logo instead of any old Nexus/generic icon.
"""
from PIL import Image
import os
import struct
import io

PUBLIC_DIR = '/home/z/my-project/public'
SOURCE_IMAGE = os.path.join(PUBLIC_DIR, 'images/logo-3boxes-hrms.png')
ICONS_DIR = os.path.join(PUBLIC_DIR, 'icons')

# Icon sizes to generate
ICON_SIZES = {
    'favicon-16x16.png': (16, 16),
    'favicon-32x32.png': (32, 32),
    'icon-152x152.png': (152, 152),
    'icon-192x192.png': (192, 192),
    'icon-512x512.png': (512, 512),
    'apple-touch-icon.png': (180, 180),
    'icon-source.png': (1024, 1024),
}

# Root-level icons (for backward compat)
ROOT_ICONS = {
    'apple-touch-icon.png': (180, 180),
    'icon-16x16.png': (16, 16),
    'icon-32x32.png': (32, 32),
    'icon-120x120.png': (120, 120),
    'icon-152x152.png': (152, 152),
    'icon-180x180.png': (180, 180),
    'icon-192x192.png': (192, 192),
    'icon-512x512.png': (512, 512),
    'icon-1024x1024.png': (1024, 1024),
}

def generate_icon(source_img, size, output_path):
    """Generate a single icon at the specified size from the source image."""
    img = source_img.resize(size, Image.LANCZOS)
    # Convert to RGB if necessary (remove alpha for PNG compatibility)
    if img.mode == 'RGBA':
        # Create white background
        background = Image.new('RGB', size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(output_path, 'PNG', optimize=True)
    print(f'  Generated: {output_path} ({size[0]}x{size[1]})')

def generate_ico(source_img, output_path):
    """Generate a favicon.ico file with 16x16 and 32x32 sizes."""
    sizes = [(16, 16), (32, 32)]
    images = []
    for size in sizes:
        img = source_img.resize(size, Image.LANCZOS)
        if img.mode == 'RGBA':
            background = Image.new('RGB', size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        images.append(img)
    
    # Use PIL to save as ICO
    images[0].save(output_path, format='ICO', sizes=[(img.width, img.height) for img in images], append_images=images[1:])
    print(f'  Generated: {output_path} (ICO with {len(sizes)} sizes)')

def main():
    print(f'Loading source image: {SOURCE_IMAGE}')
    source_img = Image.open(SOURCE_IMAGE)
    print(f'  Source size: {source_img.size}, mode: {source_img.mode}')
    
    # Generate icons in /public/icons/
    print('\n1. Generating /public/icons/ files:')
    for filename, size in ICON_SIZES.items():
        output_path = os.path.join(ICONS_DIR, filename)
        generate_icon(source_img, size, output_path)
    
    # Generate root-level icons
    print('\n2. Generating root-level /public/ icon files:')
    for filename, size in ROOT_ICONS.items():
        output_path = os.path.join(PUBLIC_DIR, filename)
        generate_icon(source_img, size, output_path)
    
    # Generate favicon.ico
    print('\n3. Generating favicon.ico:')
    generate_ico(source_img, os.path.join(PUBLIC_DIR, 'favicon.ico'))
    
    # Generate splash screens (keep existing or create basic ones)
    splash_sizes = {
        'splash-640x1136.png': (640, 1136),
        'splash-750x1334.png': (750, 1334),
        'splash-1125x2436.png': (1125, 2436),
        'splash-1242x2688.png': (1242, 2688),
    }
    print('\n4. Generating splash screen images:')
    for filename, size in splash_sizes.items():
        output_path = os.path.join(ICONS_DIR, filename)
        # Create splash screen with centered logo on dark background
        splash = Image.new('RGB', size, (15, 23, 42))  # #0F172A dark background
        logo_size = min(size[0], size[1]) // 2
        logo = source_img.resize((logo_size, logo_size), Image.LANCZOS)
        if logo.mode == 'RGBA':
            background = Image.new('RGB', (logo_size, logo_size), (15, 23, 42))
            background.paste(logo, mask=logo.split()[3])
            logo = background
        elif logo.mode != 'RGB':
            logo = logo.convert('RGB')
        x = (size[0] - logo_size) // 2
        y = (size[1] - logo_size) // 2
        splash.paste(logo, (x, y))
        splash.save(output_path, 'PNG', optimize=True)
        print(f'  Generated: {output_path} ({size[0]}x{size[1]})')
    
    # Also save splash-source.png
    source_copy = source_img.copy()
    if source_copy.mode != 'RGB':
        source_copy = source_copy.convert('RGB')
    source_copy.save(os.path.join(ICONS_DIR, 'splash-source.png'), 'PNG', optimize=True)
    print(f'  Generated: {ICONS_DIR}/splash-source.png (1024x1024)')
    
    print('\n✅ All icons regenerated from 3Boxes HRMS logo!')
    print('   Browser tabs, PWA icons, Apple touch icons, and splash screens')
    print('   will now all show the 3Boxes logo.')

if __name__ == '__main__':
    main()
