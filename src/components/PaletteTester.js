export function initPaletteTester() {
    // Only show in dev mode (localhost or specific dev flag)
    const isDev = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.search.includes('dev=true');

    if (!isDev) {
        return; // Don't initialize in production
    }

    const palettes = [
        {
            name: 'Original',
            colors: {
                '--main-bg': '#f4f4f4',
                '--main-surface': '#ffffff',
                '--main-surface-alt': '#fafafa',
                '--main-nav-bg': '#e0e0e0',
                '--main-placeholder-bg': '#e0e0e0',
                '--main-text': '#333',
                '--main-text-secondary': '#555',
                '--main-text-muted': '#999',
                '--main-text-error': '#c00'
            }
        },
        {
            name: 'Vanilla Cream',
            colors: {
                '--main-bg': '#fdfbf7',
                '--main-surface': '#fffefc',
                '--main-surface-alt': '#f9f8f4',
                '--main-nav-bg': '#f2eee5',
                '--main-placeholder-bg': '#f2ebdb',
                '--main-text': '#4a4538',
                '--main-text-secondary': '#6b6351',
                '--main-text-muted': '#a39985',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Drafting Blue',
            colors: {
                '--main-bg': '#f0f8ff',
                '--main-surface': '#f5faff',
                '--main-surface-alt': '#edf6ff',
                '--main-nav-bg': '#dbeaff',
                '--main-placeholder-bg': '#d6ebf2',
                '--main-text': '#2c3e50',
                '--main-text-secondary': '#4a6278',
                '--main-text-muted': '#8ba0b5',
                '--main-text-error': '#c0392b',
            }
        },
        {
            name: 'Script Mint',
            colors: {
                '--main-bg': '#f0fff0',
                '--main-surface': '#fafffa',
                '--main-surface-alt': '#f0fcf0',
                '--main-nav-bg': '#dfffe0',
                '--main-placeholder-bg': '#d9f2d9',
                '--main-text': '#2d4a3e',
                '--main-text-secondary': '#4b7060',
                '--main-text-muted': '#8ca89c',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Writer\'s Lavender',
            colors: {
                '--main-bg': '#f3e5f5',
                '--main-surface': '#fbf3fc',
                '--main-surface-alt': '#f5eaf7',
                '--main-nav-bg': '#e6d6eb',
                '--main-placeholder-bg': '#e8d5eb',
                '--main-text': '#4a2d52',
                '--main-text-secondary': '#6d4c78',
                '--main-text-muted': '#a68cb0',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Soft Rose',
            colors: {
                '--main-bg': '#fff0f5',
                '--main-surface': '#fff5f8',
                '--main-surface-alt': '#fff0f5',
                '--main-nav-bg': '#ffe0ea',
                '--main-placeholder-bg': '#fcddec',
                '--main-text': '#5e2d3e',
                '--main-text-secondary': '#8a5c6d',
                '--main-text-muted': '#c4a6b2',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Sunny Day',
            colors: {
                '--main-bg': '#fffacd',
                '--main-surface': '#fffff0',
                '--main-surface-alt': '#fffbea',
                '--main-nav-bg': '#fff5b0',
                '--main-placeholder-bg': '#fcf4b6',
                '--main-text': '#5c5222',
                '--main-text-secondary': '#8a7d4a',
                '--main-text-muted': '#c4bb93',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Cool Slate',
            colors: {
                '--main-bg': '#f5f5f5',
                '--main-surface': '#fafafa',
                '--main-surface-alt': '#f2f2f2',
                '--main-nav-bg': '#e6e6e6',
                '--main-placeholder-bg': '#e3e3e3',
                '--main-text': '#333',
                '--main-text-secondary': '#666',
                '--main-text-muted': '#999',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Warm Linen',
            colors: {
                '--main-bg': '#faf0e6',
                '--main-surface': '#fdfcf8',
                '--main-surface-alt': '#fbf3ea',
                '--main-nav-bg': '#f2e6d9',
                '--main-placeholder-bg': '#eee0d2',
                '--main-text': '#594a3a',
                '--main-text-secondary': '#857360',
                '--main-text-muted': '#bdaea0',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Mint Cream',
            colors: {
                '--main-bg': '#f5fffa',
                '--main-surface': '#ffffff',
                '--main-surface-alt': '#f0f9f3',
                '--main-nav-bg': '#e6f7ec',
                '--main-placeholder-bg': '#e0f5ed',
                '--main-text': '#2e5242',
                '--main-text-secondary': '#547868',
                '--main-text-muted': '#9db5aa',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Azure Mist',
            colors: {
                '--main-bg': '#f0ffff',
                '--main-surface': '#faffff',
                '--main-surface-alt': '#ebffff',
                '--main-nav-bg': '#e0fbfb',
                '--main-placeholder-bg': '#d1fafa',
                '--main-text': '#2d5e5e',
                '--main-text-secondary': '#548585',
                '--main-text-muted': '#9dc4c4',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Peach Puff',
            colors: {
                '--main-bg': '#ffdab9',
                '--main-surface': '#fff0e0',
                '--main-surface-alt': '#ffe4cc',
                '--main-nav-bg': '#ffceb0',
                '--main-placeholder-bg': '#fccdae',
                '--main-text': '#664229',
                '--main-text-secondary': '#8f6a4e',
                '--main-text-muted': '#cca991',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Lilac Breeze',
            colors: {
                '--main-bg': '#e6e6fa',
                '--main-surface': '#f0f0fc',
                '--main-surface-alt': '#e8e8fa',
                '--main-nav-bg': '#dcdcf5',
                '--main-placeholder-bg': '#dddcf5',
                '--main-text': '#483d8b',
                '--main-text-secondary': '#6a5acd',
                '--main-text-muted': '#a7a2d4',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Silver Mist',
            colors: {
                '--main-bg': '#dcdcdc',
                '--main-surface': '#ededed',
                '--main-surface-alt': '#e3e3e3',
                '--main-nav-bg': '#cfcfcf',
                '--main-placeholder-bg': '#d1d1d1',
                '--main-text': '#444',
                '--main-text-secondary': '#666',
                '--main-text-muted': '#999',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Antique Paper',
            colors: {
                '--main-bg': '#faebd7',
                '--main-surface': '#fdf7ef',
                '--main-surface-alt': '#faf0e0',
                '--main-nav-bg': '#f0dec5',
                '--main-placeholder-bg': '#ede2cd',
                '--main-text': '#5c4033',
                '--main-text-secondary': '#8b6957',
                '--main-text-muted': '#c4aead',
                '--main-text-error': '#d9534f',
            }
        },
        {
            name: 'Midnight Eclipse',
            colors: {
                '--main-bg': '#0a0a0a',
                '--main-surface': '#1a1a1a',
                '--main-surface-alt': '#141414',
                '--main-nav-bg': '#252525',
                '--main-placeholder-bg': '#2a2a2a',
                '--main-text': '#e8e8e8',
                '--main-text-secondary': '#b8b8b8',
                '--main-text-muted': '#787878',
                '--main-text-error': '#ff6b6b',
            }
        },
        {
            name: 'Deep Ocean',
            colors: {
                '--main-bg': '#0d1b2a',
                '--main-surface': '#1b263b',
                '--main-surface-alt': '#152031',
                '--main-nav-bg': '#2d4059',
                '--main-placeholder-bg': '#324a63',
                '--main-text': '#e0e1dd',
                '--main-text-secondary': '#b0c4de',
                '--main-text-muted': '#778da9',
                '--main-text-error': '#f77f00',
            }
        },
        {
            name: 'Forest Night',
            colors: {
                '--main-bg': '#0f1e13',
                '--main-surface': '#1a2e1e',
                '--main-surface-alt': '#152419',
                '--main-nav-bg': '#2d4a33',
                '--main-placeholder-bg': '#35533d',
                '--main-text': '#e8f4ea',
                '--main-text-secondary': '#b8d4bc',
                '--main-text-muted': '#7a9a7e',
                '--main-text-error': '#ff6b6b',
            }
        },
        {
            name: 'Cosmic Purple',
            colors: {
                '--main-bg': '#1a0f2e',
                '--main-surface': '#2a1b3d',
                '--main-surface-alt': '#201533',
                '--main-nav-bg': '#3d2c52',
                '--main-placeholder-bg': '#47355d',
                '--main-text': '#e8d9ff',
                '--main-text-secondary': '#c4a7e7',
                '--main-text-muted': '#9370db',
                '--main-text-error': '#ff6b9d',
            }
        },
        {
            name: 'Charcoal Steel',
            colors: {
                '--main-bg': '#1c1c1c',
                '--main-surface': '#2b2b2b',
                '--main-surface-alt': '#232323',
                '--main-nav-bg': '#3a3a3a',
                '--main-placeholder-bg': '#424242',
                '--main-text': '#e3e3e3',
                '--main-text-secondary': '#b0b0b0',
                '--main-text-muted': '#707070',
                '--main-text-error': '#ff4444',
            }
        },
        {
            name: 'Amber Night',
            colors: {
                '--main-bg': '#1f1508',
                '--main-surface': '#2e2213',
                '--main-surface-alt': '#261b0d',
                '--main-nav-bg': '#443620',
                '--main-placeholder-bg': '#4d3d26',
                '--main-text': '#f5e6d3',
                '--main-text-secondary': '#d4b896',
                '--main-text-muted': '#a68a5a',
                '--main-text-error': '#ff8c42',
            }
        },
        {
            name: 'Crimson Shadow',
            colors: {
                '--main-bg': '#1a0d0d',
                '--main-surface': '#2a1616',
                '--main-surface-alt': '#201212',
                '--main-nav-bg': '#3d2222',
                '--main-placeholder-bg': '#472828',
                '--main-text': '#ffe0e0',
                '--main-text-secondary': '#d4a0a0',
                '--main-text-muted': '#a06666',
                '--main-text-error': '#ff5252',
            }
        },
        {
            name: 'Slate Storm',
            colors: {
                '--main-bg': '#1e2329',
                '--main-surface': '#2d343e',
                '--main-surface-alt': '#252b33',
                '--main-nav-bg': '#3d4654',
                '--main-placeholder-bg': '#454f5f',
                '--main-text': '#e4e8ed',
                '--main-text-secondary': '#b4bcc8',
                '--main-text-muted': '#7a8899',
                '--main-text-error': '#f66d5f',
            }
        },
        {
            name: 'Electric Blue',
            colors: {
                '--main-bg': '#0a1628',
                '--main-surface': '#16243a',
                '--main-surface-alt': '#101d31',
                '--main-nav-bg': '#1e3a5f',
                '--main-placeholder-bg': '#26446b',
                '--main-text': '#e0f0ff',
                '--main-text-secondary': '#a8d8ff',
                '--main-text-muted': '#6ba3d8',
                '--main-text-error': '#ff6b9d',
            }
        },
        {
            name: 'Obsidian Mint',
            colors: {
                '--main-bg': '#0d1a16',
                '--main-surface': '#182823',
                '--main-surface-alt': '#12211c',
                '--main-nav-bg': '#263d36',
                '--main-placeholder-bg': '#2e463f',
                '--main-text': '#d5f5e3',
                '--main-text-secondary': '#a3d9b8',
                '--main-text-muted': '#6ba085',
                '--main-text-error': '#ff7b72',
            }
        }
    ];

    let currentIndex = 0;

    // Create container
    const container = document.createElement('div');
    container.id = 'palette-tester';
    Object.assign(container.style, {
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        backgroundColor: 'white',
        border: '1px solid #333',
        padding: '10px',
        zIndex: '10000',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        fontFamily: '"Courier New", Courier, monospace',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    });

    // Label
    const label = document.createElement('div');
    label.textContent = 'Palette Tester';
    label.style.fontWeight = 'bold';
    label.style.textAlign = 'center';
    label.style.marginBottom = '5px';
    container.appendChild(label);

    // Current Palette Name display
    const nameDisplay = document.createElement('div');
    nameDisplay.textContent = palettes[currentIndex].name;
    nameDisplay.style.textAlign = 'center';
    nameDisplay.style.marginBottom = '5px';
    container.appendChild(nameDisplay);

    // Buttons container
    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '5px'
    });
    container.appendChild(btnContainer);

    const createBtn = (text, onClick) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            backgroundColor: '#333',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
        });
        btn.onclick = onClick;
        return btn;
    };

    const updatePalette = () => {
        const palette = palettes[currentIndex];
        nameDisplay.textContent = palette.name;

        // Apply all colors in the palette
        Object.entries(palette.colors).forEach(([property, value]) => {
            document.documentElement.style.setProperty(property, value);
        });
    };

    const prevBtn = createBtn('<', () => {
        currentIndex = (currentIndex - 1 + palettes.length) % palettes.length;
        updatePalette();
    });

    const nextBtn = createBtn('>', () => {
        currentIndex = (currentIndex + 1) % palettes.length;
        updatePalette();
    });

    btnContainer.appendChild(prevBtn);
    btnContainer.appendChild(nextBtn);

    document.body.appendChild(container);

    // Initialize with current selection
    updatePalette();
}
