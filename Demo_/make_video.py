"""Render a 10-second illustrated walkthrough. Requires Pillow and ffmpeg."""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H, FPS = 1280, 720, 30
BLUE, INK, MUTED = '#2862b7', '#24334b', '#67758a'
FONTS = {size: ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', size) for size in (14, 16, 18, 20, 22, 24, 28, 32, 38)}
BOLD = {size: ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', size) for size in (16, 18, 20, 22, 24, 28, 32, 38)}
STEPS = [('게시글에서', '확장 아이콘 클릭', '댓글이 보이는 게시글을 열어 주세요.'),
         ('이 게시판에 적용', '사이트 접근 허용', '처음 사용하는 게시판에서 한 번만.'),
         ('댓글 미리보기 확인', '이 내용으로 저장', '댓글 본문이 맞는지 확인해 주세요.'),
         ('댓글 위에서', '요약 바로 확인', '다음 게시글부터는 자동으로 적용돼요.')]


def frame(t):
    im = Image.new('RGB', (W, H), '#f2f5fa')
    d = ImageDraw.Draw(im)
    def box(rect, fill, radius=14, outline=None):
        d.rounded_rectangle(rect, radius, fill=fill, outline=outline, width=2)
    def text(x, y, value, size=20, color=INK, bold=False):
        d.text((x, y), value, font=(BOLD if bold else FONTS)[size], fill=color)
    def button(rect, label, fill=BLUE):
        box(rect, fill, 9)
        font = BOLD[18]
        width = d.textlength(label, font=font)
        d.text(((rect[0]+rect[2]-width)/2, rect[1]+10), label, font=font, fill='white')
    def cursor(x, y, click=False):
        if click:
            r = 17 + 10 * math.sin(t * 12) ** 2
            d.ellipse((x-r, y-r, x+r, y+r), outline='#7ea7e6', width=3)
        points = [(x, y), (x+4, y+29), (x+11, y+22), (x+19, y+34), (x+25, y+30), (x+17, y+18), (x+28, y+17)]
        d.polygon(points, fill='white', outline=INK, width=2)
    step = 0 if t < 2.2 else 1 if t < 4.5 else 2 if t < 7 else 3
    start = [0, 2.2, 4.5, 7][step]
    local = t - start
    text(54, 38, '댓글 요약', 24, BLUE, True)
    text(190, 43, '빠른 사용법', 18, MUTED)
    box((1008, 36, 1226, 74), '#e6edf9', 19)
    text(1032, 44, '처음 등록하는 게시판', 16, BLUE)
    text(56, 189, f'0{step+1}', 38, BLUE, True)
    text(56, 265, STEPS[step][0], 28, INK, True)
    text(56, 310, STEPS[step][1], 28, INK, True)
    text(56, 382, STEPS[step][2], 16, MUTED)
    for i in range(4):
        box((56+i*86, 464, 124+i*86, 470), BLUE if i <= step else '#dbe2ec', 3)
    # Browser and illustrative public post.
    box((476, 117, 1226, 617), '#e2e8f2', 22)
    box((470, 109, 1220, 609), 'white', 18, '#dbe2ec')
    box((480, 119, 1210, 169), '#f5f7fb', 10)
    text(500, 132, '←   →', 20, MUTED)
    box((584, 128, 1110, 159), '#e8edf5', 15)
    text(602, 134, 'clien.net/service/board/park/…', 14, MUTED)
    box((1137, 125, 1180, 164), '#dce8fb', 9)
    for y, length in [(136, 22), (143, 15), (150, 19)]:
        d.line((1147, y, 1147+length, y), fill=BLUE, width=3)
    text(511, 190, '모두의공원', 16, BLUE, True)
    text(511, 225, '서로 다른 의견, 어떻게 대화하시나요?', 24, INK, True)
    text(511, 277, '생각이 달라도 서로 이해하며 이야기하고 싶어요.', 18, MUTED)
    d.line((511, 321, 1180, 321), fill='#e8edf5', width=2)
    top = 352
    if step == 3:
        box((508, 342, 1182, 458), '#f8f9fd', 12, '#dce2f2')
        box((509, 350, 513, 450), '#7185c7', 2)
        text(529, 354, '댓글 반응 요약', 18, '#5268a6', True)
        d.arc((1109, 357, 1125, 373), 30, 320, fill=MUTED, width=2)
        d.polygon([(1124, 356), (1126, 363), (1119, 361)], fill=MUTED)
        d.line([(1147, 369), (1154, 362), (1161, 369)], fill=MUTED, width=2)
        text(529, 392, '서로 설득하기 어렵다는 반응이 많고,', 20)
        text(529, 424, '공격적인 대화는 피하자는 의견이 나옵니다.', 20)
        top = 480
    text(511, top, '댓글 6', 18, INK, True)
    for i, value in enumerate(['서로 존중하는 대화가 중요하죠.', '잠시 쉬어 가는 것도 좋은 방법입니다.']):
        text(511, top+42+i*48, value, 18, MUTED)
    # Popup: actual product labels, condensed for a readable walkthrough.
    if step in (1, 2):
        box((684, 174, 1205, 592), '#cfd8e6', 14)
        box((678, 168, 1199, 586), 'white', 14, '#dce2f2')
        text(701, 186, '댓글 요약', 22, INK, True)
        text(1135, 190, '설정', 16, BLUE)
        text(701, 229, 'www.clien.net', 18, BLUE, True)
        if step == 1:
            text(701, 273, '이 게시판의 댓글 추출 규칙을 만들어요.', 20)
            text(701, 318, '현재 페이지의 텍스트와 HTML 구조를', 16, MUTED)
            text(701, 344, '서버·OpenAI에 전송합니다.', 16, MUTED)
            button((701, 395, 937, 445), '이 게시판에 적용')
            cursor(860, 423, local < 1.1)
            if local > 1.1:
                box((726, 289, 1169, 511), '#f5f7fc', 14, '#c6d4e9')
                text(750, 313, '사이트 접근 권한', 22, INK, True)
                text(750, 361, 'www.clien.net에서 사용하도록 허용', 18)
                button((1008, 435, 1142, 482), '허용')
                cursor(1083, 462, True)
        else:
            text(701, 273, '추출 미리보기', 20, INK, True)
            text(701, 314, '댓글 본문이 맞는지 확인해 주세요.', 18, MUTED)
            text(701, 359, '• 서로 존중하는 대화가 중요하죠.', 18)
            text(701, 396, '• 잠시 쉬어 가는 것도 좋습니다.', 18)
            button((701, 476, 953, 528), '이 내용으로 저장')
            cursor(862, 505, local > 1.3)
    if step == 0:
        p = min(1, local / 1.4); p = p*p*(3-2*p)
        cursor(1020 + 139*p, 270 - 124*p, local > 1.4)
    text(56, 659, '사용 흐름 예시 · 대기 시간 단축', 14, MUTED)
    box((470, 656, 1220, 661), '#dbe2ec', 2)
    box((470, 656, 470+max(2, 750*t/10), 661), BLUE, 2)
    return im


if __name__ == '__main__':
    output = ROOT / 'quick-start.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(FPS * 10):
        process.stdin.write(frame(n/FPS).tobytes())
    process.stdin.close()
    if process.wait():
        raise SystemExit('ffmpeg failed')
    frame(8.5).save(ROOT / 'preview.png')
    print(output)
