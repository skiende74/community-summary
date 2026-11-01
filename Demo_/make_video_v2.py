"""10-second v0.2.1 walkthrough: permission, shared rules, summary, tone."""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H, FPS = 1280, 720, 30
BLUE, INK, MUTED = '#2862b7', '#24334b', '#67758a'
FONTS = {(size, bold): ImageFont.truetype(f'C:/Windows/Fonts/malgun{"bd" if bold else ""}.ttf', size)
         for size in (13, 14, 16, 18, 20, 22, 24, 28, 32, 38) for bold in (False, True)}
LOGO = Image.open(ROOT.parent / 'apps/extension/public/icons/icon-128.png').convert('RGBA')
STEPS = [('사이트 권한', '한 번만 허용', '확장 아이콘 → 사이트 권한 허용 및 적용'),
         ('공용 규칙으로', '자동 적용', '다음 게시글부터는 버튼 없이 적용돼요.'),
         ('댓글 반응을', '짧게 확인', '새 댓글은 요약 갱신으로 반영해요.'),
         ('원하는 말투로', '편하게 읽기', '설정에서 선택 · 기본은 해요체')]


def frame(t):
    im = Image.new('RGB', (W, H), '#f2f5fa')
    d = ImageDraw.Draw(im)
    def box(rect, fill, radius=12, outline=None):
        d.rounded_rectangle(rect, radius, fill=fill, outline=outline, width=2)
    def text(x, y, value, size=18, color=INK, bold=False):
        d.text((x, y), value, font=FONTS[size, bold], fill=color)
    def button(rect, label):
        box(rect, BLUE, 8)
        width = d.textlength(label, font=FONTS[18, True])
        text((rect[0]+rect[2]-width)/2, rect[1]+10, label, 18, 'white', True)
    def cursor(x, y, click=False):
        if click:
            r = 16 + 8 * math.sin(t*10)**2
            d.ellipse((x-r, y-r, x+r, y+r), outline='#8daee0', width=3)
        d.polygon([(x,y), (x+4,y+28), (x+11,y+21), (x+19,y+33), (x+24,y+29), (x+17,y+18), (x+27,y+16)], fill='white', outline=INK, width=2)
    step = 0 if t < 2.5 else 1 if t < 4.7 else 2 if t < 7.2 else 3
    im.paste(LOGO.resize((44, 44), Image.Resampling.LANCZOS), (54, 32), LOGO.resize((44, 44), Image.Resampling.LANCZOS))
    text(112, 39, '커뮤니티 댓글 요약', 24, BLUE, True)
    text(1016, 47, '10초 사용법 · 0.2.1', 16, MUTED)
    text(56, 179, f'0{step+1}', 38, BLUE, True)
    text(56, 262, STEPS[step][0], 32, INK, True)
    text(56, 311, STEPS[step][1], 32, INK, True)
    text(56, 391, STEPS[step][2], 16, MUTED)
    for i in range(4):
        box((56+i*86, 464, 124+i*86, 470), BLUE if i <= step else '#dbe2ec', 3)
    box((476, 117, 1226, 617), '#e2e8f2', 22)
    box((470, 109, 1220, 609), 'white', 18, '#dbe2ec')
    box((480, 119, 1210, 169), '#f5f7fb', 10)
    text(500, 132, '←  →', 20, MUTED)
    box((584, 128, 1110, 159), '#e8edf5', 15)
    text(602, 134, '커뮤니티 게시글' if step < 3 else '댓글 요약 · 설정', 14, MUTED)
    logo = LOGO.resize((32, 32), Image.Resampling.LANCZOS)
    im.paste(logo, (1144, 128), logo)
    text(511, 191, '자유게시판', 16, BLUE, True)
    text(511, 229, '서로 다른 의견, 어떻게 대화하시나요?', 24, INK, True)
    text(511, 279, '생각이 달라도 서로 존중하며 이야기하고 싶어요.', 18, MUTED)
    d.line((511, 321, 1180, 321), fill='#e8edf5', width=2)
    top = 352
    if step == 2:
        box((508, 342, 1182, 459), '#f8f9fd', 10, '#dce2f2')
        box((509, 350, 513, 451), '#7185c7', 2)
        text(529, 354, '댓글 반응 요약', 18, '#5268a6', True)
        d.arc((1109, 357, 1125, 373), 30, 320, fill=MUTED, width=2)
        d.polygon([(1124,356), (1126,363), (1119,361)], fill=MUTED)
        d.line([(1147,369), (1154,362), (1161,369)], fill=MUTED, width=2)
        text(529, 393, '서로 설득하기는 어렵다는 반응이 많아요.', 20)
        text(529, 426, '감정이 격해지면 잠시 쉬자는 의견도 있어요.', 20)
        top = 481
        if t > 6:
            box((1007, 308, 1167, 339), '#343538', 6)
            text(1025, 313, '요약 갱신', 14, 'white')
            cursor(1120, 369)
    text(511, top, '댓글 6', 18, INK, True)
    text(511, top+43, '서로 존중하면서 대화하면 좋겠네요.', 18, MUTED)
    text(511, top+83, '잠시 쉬었다 이야기하는 것도 방법이죠.', 18, MUTED)
    if step < 2 and t > .3:
        box((678, 172, 1199, 586), 'white', 14, '#dce2f2')
        text(701, 190, '댓글 요약', 22, INK, True)
        text(1135, 194, '설정', 16, BLUE)
        text(701, 235, 'community.example', 18, BLUE, True)
        if step == 0:
            text(701, 282, '사이트 접근을 허용하면 공용 규칙을', 18)
            text(701, 313, '확인해 적용해요.', 18)
            button((701, 382, 1007, 432), '사이트 권한 허용 및 적용')
            cursor(926, 411, t > .8)
            if t > 1.5:
                box((726, 294, 1169, 520), '#f5f7fc', 14, '#c6d4e9')
                text(750, 318, '사이트 접근 권한', 22, INK, True)
                text(750, 365, '이 사이트에서 사용하도록 허용', 18)
                button((1008, 441, 1142, 488), '허용')
                cursor(1083, 465, True)
        else:
            box((701, 281, 1175, 379), '#edf7f2', 9)
            text(719, 294, '댓글 추출 정상', 20, '#36815c', True)
            text(719, 334, '텍스트 댓글 6개를 정상적으로 읽고 있어요.', 16)
            text(701, 404, '사이트 공통 규칙 · 공용 규칙에서 적용', 16, MUTED)
            button((701, 454, 979, 504), '이 게시판 맞춤 설정')
            text(701, 537, '사이트 공통 규칙을 적용했어요.', 18, BLUE)
    if t <= .3:
        cursor(1159, 145, True)
    if step == 3:
        box((490, 179, 1200, 590), '#f4f6fb', 10)
        text(521, 201, '댓글 반응을 요약해, 한눈에 편하게.', 24, INK, True)
        box((520, 259, 1170, 551), 'white', 12, '#dce2ee')
        text(542, 278, '요약 말투', 20, INK, True)
        text(542, 314, '새 요약이나 요약 갱신부터 적용돼요.', 16, MUTED)
        for i, (label, example) in enumerate([('음슴체', '비판하는 반응이 많음.'), ('해요체 (기본)', '비판하는 반응이 많아요.'), ('습니다체', '비판하는 반응이 많습니다.')]):
            y = 356+i*58
            box((538, y, 1151, y+49), '#e9f0fc' if i == 1 else '#f8f9fc', 7)
            text(554, y+12, label, 18, BLUE if i == 1 else INK, i == 1)
            text(778, y+13, example, 16, MUTED)
        cursor(728, 441)
    text(56, 650, '예시 UI · 공용 규칙이 등록된 사이트 기준 · 대기 시간 단축', 14, MUTED)
    box((56, 687, 1220, 691), '#dbe2ec', 2)
    box((56, 687, 56+max(2, 1164*t/10), 691), BLUE, 2)
    return im


if __name__ == '__main__':
    output = ROOT / 'quick-start-v2.mp4'
    process = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
        '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)], stdin=subprocess.PIPE)
    for n in range(FPS*10):
        process.stdin.write(frame(n/FPS).tobytes())
    process.stdin.close()
    if process.wait():
        raise SystemExit('ffmpeg failed')
    frame(5.5).save(ROOT / 'preview-v2.png')
    print(output)
