const { Telegraf, Markup } = require('telegraf');

// توکن ربات شما
const bot = new Telegraf('8962912235:AAG9tH-UH7y2YUA_fxWBtfwupo7_nwLwN-o', {
    handlerTimeout: 90000
});

// پایگاه داده موقت برای کانال‌ها
const db = {
    channels: {},
    registering: new Set()
};

// منوی اصلی با دکمه‌های شیشه‌ای روی صفحه
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

// ثبت کانال
bot.action('register_channel', async (ctx) => {
    db.registering.add(ctx.from.id);
    await ctx.editMessageText(
        '۱. ابتدا ربات را **مدیر (Admin)** کانال خود کنید (با دسترسی کامل).\n۲. سپس اینجا یوزرنیم کانالتون رو به طور مثال `@batman179` بفرستید.',
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 بازگشت', 'back_to_home')]
        ])
    );
});

// لیست کانال‌های من
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

    let buttons = userChannels.map(([username]) => [
        Markup.button.callback(`❌ حذف ${username}`, `del_${username}`)
    ]);
    buttons.push([Markup.button.callback('🔙 بازگشت', 'back_to_home')]);

    await ctx.editMessageText(
        'لیست کانال‌های ثبت شده شما:\nبرای حذف هر کدام روی گزینه حذف بزنید:',
        Markup.inlineKeyboard(buttons)
    );
});

// اطلاعات سازنده (آیدی)
bot.action('creator_id', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('آیدی سازنده ربات:\n@batman1792');
});

// اطلاعات سازنده (کانال)
bot.action('creator_channel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('کانال سازنده ربات:\n@batman179');
});

// بازگشت به منوی اصلی
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

// دریافت متون (برای ثبت آیدی کانال)
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    if (db.registering.has(userId)) {
        if (!text.startsWith('@')) {
            return ctx.reply('فرمت اشتباه است! لطفاً یوزرنیم کانال را به طور مثال `@batman179` بفرستید.');
        }

        const channelUsername = text;

        try {
            const chatMember = await ctx.telegram.getChatMember(channelUsername, ctx.botInfo.id);
            if (chatMember.status !== 'administrator') {
                return ctx.reply('❌ خطا! ربات را مدیر کانال خود نکرده‌اید. لطفاً ابتدا ربات را ادمین کنید سپس یوزرنیم را بفرستید.');
            }

            db.channels[channelUsername] = {
                ownerId: userId
            };

            db.registering.delete(userId);
            await ctx.reply(
                `✅ کانال ${channelUsername} با موفقیت ثبت شد! از این پس ترک کاربران اطلاع‌رسانی خواهد شد.`,
                mainMenu
            );
        } catch (error) {
            console.error(error);
            await ctx.reply('❌ خطا در دسترسی به کانال. مطمئن شوید یوزرنیم صحیح است و ربات در آن ادمین است.');
        }
    }
});

// رصد لفت دادن (ترک کانال) با پشتیبانی از chat_member
bot.on('chat_member', async (ctx) => {
    try {
        const update = ctx.chatMember;
        if (!update) return;

        const chat = update.chat;
        const oldStatus = update.old_chat_member.status;
        const newStatus = update.new_chat_member.status;
        const user = update.from;

        const leftStatuses = ['left', 'kicked'];
        const wasMember = ['member', 'administrator', 'creator'].includes(oldStatus);
        const isNowLeft = leftStatuses.includes(newStatus);

        if (wasMember && isNowLeft && chat && chat.username) {
            const channelUsername = `@${chat.username}`;
            const channelData = db.channels[channelUsername];

            if (channelData) {
                const ownerId = channelData.ownerId;
                const message = `کاربر ${user.first_name} با آیدی \`${user.id}\` از کانال شما (${channelUsername}) خارج شد!`;
                
                await bot.telegram.sendMessage(ownerId, message, { parse_mode: 'Markdown' });
            }
        }
    } catch (err) {
        console.error('خطا در پردازش لفت دادن کاربر:', err);
    }
});

// تنظیم وب‌هوک برای Railway
const DOMAIN = 'bot-production-d226.up.railway.app';
const PORT = process.env.PORT || 3000;
const SECRET_PATH = '/webhook';

bot.launch({
    webhook: {
        domain: DOMAIN,
        port: PORT,
        hookPath: SECRET_PATH
    }
}).then(() => {
    console.log(`✅ Webhook set successfully & Bot is running on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
