import pygame
import os 
import time 
import random

pygame.font.init()

# 1. AWALAN (seberapa besar windows nanti pas di run)
TINGGI, LEBAR = 600, 600
WIN = pygame.display.set_mode((LEBAR, TINGGI))
pygame.display.set_caption("Guardia shooter")


# munculkan musuh
player_MERAH = pygame.image.load(os.path.join("assets", "pixel_ship_red_small.png"))
player_HIJAU = pygame.image.load(os.path.join("assets", "pixel_ship_green_small.png"))
player_BIRU = pygame.image.load(os.path.join("assets", "pixel_ship_blue_small.png"))

# munculkan player 
player_KUNING= pygame.image.load(os.path.join("assets", "pixel_ship_yellow.png"))

# munculkan laser
LASER_MERAH = pygame.image.load(os.path.join("assets", "pixel_laser_red.png"))
LASER_BIRU = pygame.image.load(os.path.join("assets", "pixel_laser_blue.png"))
lASER_HIJAU = pygame.image.load(os.path.join("assets", "pixel_laser_green.png"))
LASER_KUNING = pygame.image.load(os.path.join("assets", "pixel_laser_yellow.png"))

# latar 
BACKGROUND = pygame.transform.scale(pygame.image.load(os.path.join("assets2", "pixel_bg_moon.png")), (LEBAR, TINGGI))

class Laser:
    def __init__(self, x, y, img):
        self.x = x
        self.y = y
        self.img = img
        self.mask = pygame.mask.from_surface(self.img)

    def draw(self, window):
        window.blit(self.img, (self.x, self.y))

    def move(self, gerak):
        self.y += gerak

    def off_screen(self, height):
        return not(self.y <= height and self.y >= 0)

    def tabrakan(self, obj):
        return tabrak(self, obj)

class player:
    COOLDOWN = 30

    def __init__(self, x, y, kerusakan=100):
        self.x = x
        self.y = y 
        self.kerusakan = kerusakan
        self.ship_img = None
        self.laser_img = None
        self.lasers = []
        self.loading_tembak = 0


    def draw(self, window):
        window.blit(self.ship_img, (self.x, self.y))
        # pygame.draw.rect(window, (255, 0, 0), (self.x, self.y, 50, 50))
        for laser in self.lasers:
            laser.draw(window)

    def move_lasers(self, gerak, obj):
        self.cooldown()
        for laser in self.lasers:
            laser.move(gerak)
            if laser.off_screen(TINGGI):
                self.lasers.remove(laser)
            elif laser.tabrakan(obj):
                obj.kerusakan -= 10
                self.lasers.remove(laser)

    def cooldown(self):
        if self.loading_tembak >= self.COOLDOWN:
            self.loading_tembak = 0
        elif self.loading_tembak > 0:
            self.loading_tembak += 1

    def shoot(self):
        if self.loading_tembak == 0:
            laser = Laser(self.x, self.y, self.laser_img)
            self.lasers.append(laser)
            self.loading_tembak = 1

    def get_width(self):
        return self.ship_img.get_width()

    def get_height(self):
        return self.ship_img.get_height()

class Player(player):
    def __init__(self, x, y, kerusakan = 100):
        super().__init__(x, y, kerusakan)
        self.ship_img = player_KUNING
        self.laser_img = LASER_KUNING
        self.mask = pygame.mask.from_surface(self.ship_img)
        self.max_kerusakan = kerusakan
        
    def move_lasers(self, gerak, objs):
        self.cooldown()
        for laser in self.lasers:
            laser.move(gerak)
            if laser.off_screen(TINGGI):
                self.lasers.remove(laser)
            else:
                for obj in objs:
                    if laser.tabrakan(obj):
                        objs.remove(obj)
                        if laser in self.lasers:
                            self.lasers.remove(laser)

    def draw(self, window):
        super().draw(window)
        self.healthbar(window)

    def healthbar(self, window):
        pygame.draw.rect(window, (255,0,0),(self.x, self.y + self.ship_img.get_height() + 10, self.ship_img.get_width(), 10))
        pygame.draw.rect(window,(0,255,0), (self.x, self.y + self.ship_img.get_height() + 10, self.ship_img.get_width() * (self.kerusakan/self.max_kerusakan), 10))

class Musuh(player):
    warna_dic = {
                "merah": (player_MERAH, LASER_MERAH),
                "hijau": (player_HIJAU, lASER_HIJAU),
                "biru": (player_BIRU, LASER_BIRU),
                }

    def __init__(self, x, y, warna, kerusakan = 100) :
        super().__init__(x, y, kerusakan)
        self.ship_img, self.laser_img = self.warna_dic[warna]
        self.mask = pygame.mask.from_surface(self.ship_img)

    def move(self, gerak) :
        self.y += gerak
    
    def shoot(self):
        if self.loading_tembak == 0:
            laser = Laser(self.x-20, self.y, self.laser_img)
            self.lasers.append(laser)
            self.loading_tembak = 1

def tabrak(obj1, obj2):
    offset_x = obj2.x - obj1.x
    offset_y = obj2.y - obj1.y
    return obj1.mask.overlap(obj2.mask, (offset_x, offset_y)) != None

# 2. main 
# loop apa yang menangani semua genap kita
# menangani tabrakan
# apa panggilan hal-hal yang akan digambar di layar
# apa yang memungkinkan kita untuk keluar dari permainan
# memindahkan hal-hal karakter seperti itu

def main(): #
    run = True
    FPS = 60
    level = 0
    nyawa = 3
    main_font = pygame.font.SysFont("calibri", 20)
    kalah_font = pygame.font.SysFont("comicsans", 40)
    kalah_hitung = 0
    musuhmusuh = []
    gerombolan_gelombang = 5
    gerak_musuh = 1

    gerak_player = 5
    gerak_lasers = 6

    player = Player(275, 500)

    clock = pygame.time.Clock()

    kalah = False 

    def redraw_window():
        WIN.blit(BACKGROUND, (0, 0))

        # draw text
        level_label = main_font.render(f"Level: {level}", 1, (50, 255, 50))
        nyawa_label = main_font.render(f"Nyawa: {nyawa}", 1, (50, 255, 50))

        WIN.blit(level_label, (10, 10))
        WIN.blit(nyawa_label, (LEBAR - nyawa_label.get_width() - 10, 10))

        for musuh in musuhmusuh :
            musuh.draw(WIN)

        player.draw(WIN)

        if kalah :
            kalah_label = kalah_font.render("Anda Kalah :(", 1, (255, 50, 50))
            WIN.blit(kalah_label, (LEBAR/2 - level_label.get_width()/2, 250))

        pygame.display.update()


    while run:
        clock.tick(FPS)
        redraw_window()

        if nyawa <= 0 or player.kerusakan <= 0:
            kalah = True
            kalah_hitung += 1

        if kalah:
            if kalah_hitung > FPS * 3:
                run = False
            else:
                continue

        if len(musuhmusuh) == 0:
            level += 1
            gerombolan_gelombang += 3
            for i in range(gerombolan_gelombang) :
                musuh = Musuh(random.randrange(100, LEBAR - 100), random.randrange(-1500, -100), random.choice(["merah","biru","hijau"]))
                musuhmusuh.append(musuh)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                quit()

        keys = pygame.key.get_pressed()
        if keys[pygame.K_LEFT] and player.x - gerak_player > 0: # left
            player.x -= gerak_player
        if keys[pygame.K_RIGHT] and player.x + player.get_width() < LEBAR: # kanan
            player.x += gerak_player
        if keys[pygame.K_UP] and player.y - gerak_player > 0: # atas
            player.y -= gerak_player
        if keys[pygame.K_DOWN] and player.y + player.get_height() < TINGGI: # bawah
            player.y += gerak_player
        if keys[pygame.K_SPACE]:
            player.shoot()

            
        for musuh in musuhmusuh[:]:
            musuh.move(gerak_musuh)
            musuh.move_lasers(gerak_lasers, player)

            if random.randrange(0, 2*60) == 1:
                musuh.shoot()

            if tabrak(musuh, player):
                player.kerusakan -= 10
                musuhmusuh.remove(musuh)
            elif musuh.y + musuh.get_height() > TINGGI:
                nyawa -= 1
                musuhmusuh.remove(musuh)

        player.move_lasers(-gerak_lasers, musuhmusuh)

def main_menu():
    title_font = pygame.font.SysFont("comicsans", 40)
    run = True
    while run:
        WIN.blit(BACKGROUND, (0,0))
        title_label = title_font.render("Tekan menu untuk mulai...", 1, (255,255,255))
        WIN.blit(title_label, (LEBAR/2 - title_label.get_width()/2, 350))
        pygame.display.update()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False
            if event.type == pygame.MOUSEBUTTONDOWN:
                main()
    pygame.quit()


main_menu()