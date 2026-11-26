const rules = [
    [/(?:钓鱼|网络钓鱼|phish(?:ing)?|撞库|credential stuffing).{0,45}(?:盗|窃|骗取|收集|记录|截获|账号密码|验证码|password|credential|otp|session cookie)|(?:盗取|窃取|偷取|steal|harvest|exfiltrate).{0,30}(?:密码|凭据|会话|令牌|password|credential|token|cookie)/iu, '凭据窃取或网络钓鱼'],
    [/(?:编写|制作|生成|部署|运行|发送|写一个|create|write|build|deploy|send).{0,45}(?:勒索软件|键盘记录器|远控木马|恶意软件|ransomware|infostealer|keylogger|malware)(?!\s*(?:检测|防护|清除|分析|scanner|detector|analysis|removal))/iu, '恶意软件'],
    [/(?:绕过登录|绕过鉴权|攻击|入侵|侵入|拿下|hack into|break into|bypass authentication).{0,55}(?:别人|陌生人|第三方|未授权|没有授权|未经授权|someone else|without permission|unauthori[sz]ed|third.party)/iu, '未获授权的入侵'],
    [/(?:骗取|伪造|冒充|洗钱|forge|counterfeit|impersonate).{0,35}(?:身份证|证件|付款凭证|转账截图|信用卡|银行卡|身份证明|payment receipt|passport|credit card|bank statement)|(?:公开|泄露|搜集|查出|doxx?|publish|leak).{0,35}(?:他人|别人|someone'?s|private).{0,30}(?:住址|家庭地址|身份证|home address|social security)/iu, '欺诈、伪造或侵犯隐私'],
    [/(?:制作|制造|组装|引爆|制造方法|步骤|配方|build|make|assemble|detonate|recipe).{0,38}(?:炸弹|简易爆炸装置|化学武器|生物武器|毒气|bomb|explosive device|chemical weapon|biological weapon)(?!\s*(?:动画|特效|道具|游戏|模型|animation|effect|prop|game|in blender))/iu, '制造或使用危险武器'],
    [/(?:生成|生成图片|画|制作|创作|generate|create|draw|write).{0,38}(?:儿童色情|未成年人色情|儿童性虐待|child pornography|sexual images of (?:children|minors)|child sexual abuse material)/iu, '侵害未成年人'],
];

export function screenPrompt(content) {
    const text = content.normalize('NFKC').replace(/[\p{Cf}\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ');
    return rules.find(([pattern]) => pattern.test(text))?.[1];
}
