# Migration Guide: jQuery to Vanilla JS (v8)

This guide shows how to migrate from jQuery to vanilla JavaScript using the new utility modules.

## 📦 New Utility Modules

### 1. DOMHelper (`utils/dom-helper.js`)
Replaces all jQuery DOM manipulation

### 2. HTTPHelper (`utils/http-helper.js`)
Replaces `$.ajax()` with modern Fetch API

### 3. DOMPurifyLoader (`utils/dompurify-loader.js`)
XSS protection for HTML insertion

---

## 🔄 Migration Examples

### Module Import

**OLD (v7):**
```javascript
define([
    'jquery',
    './foundation/odag-state-manager'
], function($, StateManager) {
    // Use jQuery
    $('#button').click(function() { ... });
});
```

**NEW (v8):**
```javascript
define([
    './utils/dom-helper',
    './utils/http-helper',
    './utils/dompurify-loader',
    './foundation/odag-state-manager'
], function(DOM, HTTP, DOMPurify, StateManager) {
    // Use vanilla JS utilities
    DOM.on('#button', 'click', function() { ... });
});
```

---

## DOM Manipulation

### Select Elements

**OLD:**
```javascript
const element = $('#my-id');
const elements = $('.my-class');
```

**NEW:**
```javascript
const element = DOM.get('#my-id');
const elements = DOM.getAll('.my-class');
```

### Add/Remove Classes

**OLD:**
```javascript
$('#button').addClass('active');
$('#button').removeClass('inactive');
$('#button').toggleClass('hidden');
```

**NEW:**
```javascript
DOM.addClass('#button', 'active');
DOM.removeClass('#button', 'inactive');
DOM.toggleClass('#button', 'hidden');
```

### Set HTML Content (SAFE)

**OLD (UNSAFE):**
```javascript
$('#container').html(content); // XSS risk!
```

**NEW (SAFE):**
```javascript
// Automatically sanitized with DOMPurify
DOM.setHTML('#container', content);

// Or manually:
const purify = DOMPurify.get();
element.innerHTML = purify.sanitize(content);
```

### Set Text Content

**OLD:**
```javascript
$('#message').text('Hello World');
```

**NEW:**
```javascript
DOM.setText('#message', 'Hello World');
```

### Event Handling

**OLD:**
```javascript
$('#button').on('click', function() {
    console.log('clicked');
});

$('#button').off('click', handler);
```

**NEW:**
```javascript
DOM.on('#button', 'click', function() {
    console.log('clicked');
});

DOM.off('#button', 'click', handler);
```

### Show/Hide Elements

**OLD:**
```javascript
$('#element').show();
$('#element').hide();
```

**NEW:**
```javascript
DOM.show('#element');
DOM.hide('#element');
```

---

## HTTP Requests

### GET Request

**OLD:**
```javascript
$.ajax({
    url: apiUrl,
    method: 'GET',
    headers: {
        'Authorization': 'Bearer token'
    },
    success: function(data) {
        console.log(data);
    },
    error: function(error) {
        console.error(error);
    }
});
```

**NEW:**
```javascript
try {
    const data = await HTTP.get(apiUrl, {
        headers: {
            'Authorization': 'Bearer token'
        }
    });
    console.log(data);
} catch (error) {
    console.error(error);
}
```

### POST Request

**OLD:**
```javascript
$.ajax({
    url: apiUrl,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    data: JSON.stringify(payload),
    success: function(response) {
        console.log(response);
    }
});
```

**NEW:**
```javascript
try {
    const response = await HTTP.post(apiUrl, payload, {
        headers: {
            'Content-Type': 'application/json'
        }
    });
    console.log(response);
} catch (error) {
    console.error(error);
}
```

### DELETE Request

**OLD:**
```javascript
$.ajax({
    url: apiUrl,
    method: 'DELETE',
    success: function() {
        console.log('Deleted');
    }
});
```

**NEW:**
```javascript
try {
    await HTTP.delete(apiUrl);
    console.log('Deleted');
} catch (error) {
    console.error(error);
}
```

---

## Common Patterns

### Creating Elements

**OLD:**
```javascript
const button = $('<button>')
    .addClass('odag-btn')
    .attr('id', 'my-button')
    .text('Click Me');
```

**NEW:**
```javascript
const button = DOM.create('button', {
    class: 'odag-btn',
    id: 'my-button'
}, 'Click Me');
```

### Appending Elements

**OLD:**
```javascript
$('#container').append('<div class="item">Content</div>');
```

**NEW:**
```javascript
DOM.append('#container', '<div class="item">Content</div>');
// Automatically sanitized with DOMPurify!
```

### Removing Elements

**OLD:**
```javascript
$('#element').remove();
```

**NEW:**
```javascript
DOM.remove('#element');
```

### Checking if Element Exists

**OLD:**
```javascript
if ($('#element').length > 0) {
    // Element exists
}
```

**NEW:**
```javascript
if (DOM.exists('#element')) {
    // Element exists
}
```

---

## Real-World Example

### Before (jQuery):

```javascript
define(['jquery'], function($) {

    function initializeView(containerId, data) {
        const $container = $('#' + containerId);

        // Clear container
        $container.empty();

        // Build HTML
        const html = '<div class="header">' + data.title + '</div>';
        $container.html(html); // XSS RISK!

        // Add click handler
        $container.find('.header').on('click', function() {
            alert('Clicked!');
        });

        // Make API call
        $.ajax({
            url: '/api/data',
            method: 'POST',
            data: JSON.stringify(data),
            success: function(response) {
                $container.addClass('loaded');
            },
            error: function(error) {
                $container.addClass('error');
            }
        });
    }

    return { initializeView: initializeView };
});
```

### After (Vanilla JS):

```javascript
define([
    './utils/dom-helper',
    './utils/http-helper',
    './utils/dompurify-loader'
], function(DOM, HTTP, DOMPurify) {

    async function initializeView(containerId, data) {
        const container = DOM.get('#' + containerId);

        // Clear container
        DOM.empty(container);

        // Build HTML (SAFE - sanitized automatically)
        const html = '<div class="header">' + data.title + '</div>';
        DOM.setHTML(container, html);

        // Add click handler
        const header = DOM.get('.header');
        DOM.on(header, 'click', function() {
            alert('Clicked!');
        });

        // Make API call
        try {
            const response = await HTTP.post('/api/data', data);
            DOM.addClass(container, 'loaded');
        } catch (error) {
            DOM.addClass(container, 'error');
        }
    }

    return { initializeView: initializeView };
});
```

---

## Benefits of v8

### ✅ Security
- **XSS Protection**: DOMPurify sanitizes all HTML
- **No jQuery vulnerabilities**: Eliminated dependency security risks
- **Modern security practices**: Follows current best practices

### ✅ Performance
- **Smaller bundle**: ~10KB savings (no jQuery)
- **Faster execution**: Native APIs are faster
- **Better caching**: Browser can cache utilities

### ✅ Maintainability
- **Modern code**: ES6+ features
- **Better debugging**: Clearer stack traces
- **Future-proof**: Based on web standards

---

## Migration Checklist

- [ ] Replace all `$()` selectors with `DOM.get()` or `DOM.getAll()`
- [ ] Replace `.html()` with `DOM.setHTML()` (sanitized)
- [ ] Replace `.text()` with `DOM.setText()`
- [ ] Replace `.addClass()` / `.removeClass()` with `DOM.addClass()` / `DOM.removeClass()`
- [ ] Replace `.on()` / `.off()` with `DOM.on()` / `DOM.off()`
- [ ] Replace `$.ajax()` with `HTTP.get()` / `HTTP.post()` / etc.
- [ ] Load DOMPurify on initialization: `await DOMPurify.load()`
- [ ] Test all functionality thoroughly
- [ ] Update module dependencies to include new utilities

---

## Testing

After migration, ensure you test:

1. ✅ All DOM manipulations work correctly
2. ✅ All event handlers fire properly
3. ✅ All AJAX calls succeed
4. ✅ HTML is properly sanitized (no XSS)
5. ✅ Performance is equal or better
6. ✅ Works on Cloud and On-Premise
7. ✅ Works on all supported browsers

---

## Need Help?

- Review `utils/dom-helper.js` for all available DOM methods
- Review `utils/http-helper.js` for all HTTP methods
- Check browser console for migration warnings
- Test in incognito mode to avoid caching issues

---

**Migration to v8 = Safer, Faster, Modern! 🚀**
