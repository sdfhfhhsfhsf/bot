const { Telegraf, Markup } = require('telegraf');

// توکن ربات خود را از BotFather بگیرید و اینجا قرار دهید یا به صورت متغیر محیطی تنظیم کنید
const bot = new Telegraf(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE');

// پایگاه داده موقت در حافظه (برای پایداری بیشتر در ریلویت می‌توانید از SQLite یا MongoDB استفاده کنید)
// ساختار: db.channels[channelUsername] = { ownerId, title }
const db = {
    channels: {},
    registering: new Set() // کاربرانی که در مرحله ارسال آیدی کانال هستند
};

// منوی اصلی با کیبورد شیشه‌ای (Inline Keyboard)
const mainMenu = Markup.inlineKeyboard([
    [Markup.button.callback('📌 ثبت کانال', 'register_channel')],
    [Markup.button.callback('📋 کانال‌های من', 'my_channels')],
    [
        Markup.button.callback('👤 آیدی سازنده', 'creator_id'),
        Markup.button.callback('📢 چنل سازنده', 'creator_channel')
    ]
]);

// دستور استارت
bot.start((ctx) => {
    db.registering.delete(ctx.from.id);
    ctx.reply(
        'سلام! 👋\nبه ربات مدیریت کانال خوش آمدید. از منوی زیر یکی از گزینه‌ها را انتخاب کنید:',
        mainMenu
    );
});

// مدیریت کلیک دکمه‌ها
bot.action('register_channel', async (ctx) => {
    db.registering.add(ctx.from.id);
    await ctx.editMessageText(
        '۱. ابتدا ربات را **ادمین** کانال خود کنید.\n۲. سپس یوزرنیم کانال خود را به طور مثال `@batman179` بفرستید.',
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 بازگشت', 'back_to_home')]
        ])
    );
});

bot.action('my_channels', async (ctx) => {
    const userId = ctx.from.id;
    const userChannels = Object.entries(db.channels).filter(([_, data]) => data.ownerId === userId);

    if (userChannels.length === 0) {
        return ctx.editMessageText(
            'شما هنوز هیچ کانالی ثبت نکرده‌اید.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 بازگشت', 'back_to_home')]
            ])
        );
    }

    let buttons = userChannels.map(([username, data]) => [
        Markup.button.callback(`❌ حذف ${username}`, `del_${username}`)
    ]);
    buttons.push([Markup.button.callback('🔙 بازگشت', 'back_to_home')]);

    await ctx.editMessageText(
        'لیست کانال‌های ثبت شده شما:\nبرای حذف هر کدام روی دکمه مربوطه بزنید:',
        Markup.inlineKeyboard(buttons)
    );
});

bot.action('creator_id', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('آیدی سازنده ربات:\n@batman1792');
});

bot.action('creator_channel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('کانال سازنده ربات:\n@batman179');
});

bot.action('back_to_home', async (ctx) => {
    db.registering.delete(ctx.from.id);
    await ctx.editMessageText(
        'منوی اصلی ربات:',
        mainMenu
    );
});

// حذف کانال
bot.action(/del_(.+)/, async (ctx) => {
    const username = ctx.match[1];
    if (db.channels[username]) {
        delete db.channels[username];
        await ctx.answerCbQuery('کانال با موفقیت حذف شد.');
    }
    // بروزرسانی لیست
    const userId = ctx.from.id;
    const userChannels = Object.entries(db.channels).filter(([_, data]) => data.ownerId === userId);
    
    if (userChannels.length === 0) {
        return ctx.editMessageText(
            'کانالی ثبت نشده است.',
            Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'back_to_home')]])
        );
    }

    let buttons = userChannels.map(([uname]) => [
        Markup.button.callback(`❌ حذف ${uname}`, `del_${uname}`)
    ]);
    buttons.push([Markup.button.callback('🔙 بازگشت', 'back_to_home')]);

    await ctx.editMessageText('لیست کانال‌های شما:', Markup.inlineKeyboard(buttons));
});

// دریافت متون ارسالی (برای ثبت کانال)
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    if (db.registering.has(userId)) {
        if (!text.startsWith('@')) {
            return ctx.reply('فرمت اشتباه است! لطفاً یوزرنیم کانال را با @ بفرستید. مثال: @batman179');
        }

        const channelUsername = text;

        try {
            // بررسی اینکه آیا ربات در کانال ادمین است یا خیر
            const chatMember = await ctx.telegram.getChatMember(channelUsername, ctx.botInfo.id);
            if (chatMember.status !== 'administrator') {
                return ctx.reply('❌ خطا! ربات هنوز در این کانال ادمین نیست. لطفاً ابتدا ربات را ادمین کنید و دوباره یوزرنیم را بفرستید.');
            }

            // ذخیره کانال
            db.channels[channelUsername] = {
                ownerId: userId,
                title: channelUsername
            };

            db.registering.delete(userId);
            await ctx.reply(
                `✅ کانال ${channelUsername} با موفقیت ثبت شد و از این پس لف دادن کاربران رصد خواهد شد!`,
                mainMenu
            );
        } catch (error) {
            console.error(error);
            await ctx.reply('❌ خطا در دسترسی به کانال. مطمئن شوید که یوزرنیم را درست وارد کرده‌اید و ربات در کانال ادمین است.');
        }
    }
});

// رصد ترک کانال توسط کاربران
bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    const chat = update.chat;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;
    const user = update.from;

    // بررسی اینکه آیا کاربر کانال را ترک کرده است (left) یا از کانال اخراج شده (kicked)
    const leftStatuses = ['left', 'kicked'];
    const wasMember = ['member', 'administrator', 'creator'].includes(oldStatus);
    const isNowLeft = leftStatuses.includes(newStatus);

    if (wasMember && isNowLeft && chat.username) {
        const channelUsername = `@${chat.username}`;
        const channelData = db.channels[channelUsername];

        if (channelData) {
            const ownerId = channelData.ownerId;
            const message = `⚠️ کاربر [${user.first_name}](tg://user?id=${user.id}) با آیدی \`${user.id}\` از کانال ${channelUsername} خارج شد!`;
            
            try {
                await bot.telegram.sendMessage(ownerId, message, { parse_mode: 'Markdown' });
            } catch (err) {
                console.error('خطا در ارسال پیام به مالک کانال:', err);
            }
        }
    }
});

// راه‌اندازی ربات
bot.launch().then(() => {
    console.log('Bot is running...');
});

// بستن امن ربات
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
