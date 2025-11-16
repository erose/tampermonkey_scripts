// ==UserScript==
// @name         Twitter/X Scroll Inhibitor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Progressively delay scrolling on Twitter/X based on tweets viewed to reduce addictive scrolling
// @author       You
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    let tweetsViewed = 0;
    let isBlocked = false;
    let seenTweets = new Set();
    let modal = null;
    let intersectionObserver = null;
    let mutationObserver = null;
    
    function createModal() {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'scroll-inhibitor-modal';
        modalDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            min-width: 300px;
            backdrop-filter: blur(5px);
            border: 2px solid #1d9bf0;
        `;
        
        modalDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #1d9bf0;">🐌</h3>
            <p style="margin: 0 0 10px 0;">You've viewed <span style="color: #ffd700; font-weight: bold;">${tweetsViewed}</span> tweets...</p>
            <p id="countdown" style="margin: 0; font-size: 24px; font-weight: bold; color: #ffd700;"></p>
        `;
        
        document.body.appendChild(modalDiv);
        return modalDiv;
    }
    
    function showModal(seconds) {
        if (!modal) {
            modal = createModal();
        } else {
            // Update tweet count in existing modal
            modal.querySelector('span').textContent = tweetsViewed;
        }
        
        modal.style.display = 'block';
        const countdown = modal.querySelector('#countdown');
        
        let remaining = seconds;
        countdown.textContent = `${remaining}s`;
        
        const timer = setInterval(() => {
            remaining--;
            countdown.textContent = `${remaining}s`;
            
            if (remaining <= 0) {
                clearInterval(timer);
                hideModal();
            }
        }, 1000);
    }
    
    function hideModal() {
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    function blockScrolling() {
        isBlocked = true;
    }
    
    function unblockScrolling() {
        isBlocked = false;
    }
    
    function getTweetId(tweetElement) {
        // Try to extract unique identifier from tweet
        const link = tweetElement.querySelector('a[href*="/status/"]');
        if (link) {
            const match = link.href.match(/\/status\/(\d+)/);
            if (match) return match[1];
        }
        
        // Fallback: use element's position in DOM as ID
        return tweetElement.getBoundingClientRect().top + '_' + tweetElement.getBoundingClientRect().left;
    }
    
    function handleTweetInView(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                const tweetElement = entry.target;
                const tweetId = getTweetId(tweetElement);
                
                if (!seenTweets.has(tweetId)) {
                    seenTweets.add(tweetId);
                    tweetsViewed++;
                    
                    console.log(`Tweet viewed: ${tweetsViewed} total`);
                    
                    // Check if we've hit a 10-tweet milestone
                    if (tweetsViewed % 10 === 0) {
                        const delaySeconds = Math.floor(tweetsViewed / 2);
                        
                        console.log(`Tweet milestone: ${tweetsViewed} tweets viewed, ${delaySeconds}s delay`);
                        
                        blockScrolling();
                        showModal(delaySeconds);
                        
                        setTimeout(() => {
                            unblockScrolling();
                        }, delaySeconds * 1000);
                    }
                }
            }
        });
    }
    
    function observeExistingTweets() {
        const tweets = document.querySelectorAll('[data-testid="tweet"]');
        tweets.forEach(tweet => {
            intersectionObserver.observe(tweet);
        });
        console.log(`Started observing ${tweets.length} existing tweets`);
    }
    
    function setupIntersectionObserver() {
        intersectionObserver = new IntersectionObserver(handleTweetInView, {
            root: null, // viewport
            rootMargin: '0px',
            threshold: 0.5 // trigger when 50% of tweet is visible
        });
        
        observeExistingTweets();
    }
    
    function setupMutationObserver() {
        mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is a tweet
                        if (node.matches && node.matches('[data-testid="tweet"]')) {
                            intersectionObserver.observe(node);
                        }
                        // Check if any children are tweets
                        const tweets = node.querySelectorAll && node.querySelectorAll('[data-testid="tweet"]');
                        if (tweets) {
                            tweets.forEach(tweet => intersectionObserver.observe(tweet));
                        }
                    }
                });
            });
        });
        
        // Observe the main timeline container
        const timelineContainer = document.querySelector('[role="main"]') || document.body;
        mutationObserver.observe(timelineContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('MutationObserver setup complete');
    }
    
    function preventScrollingDuringBlock(e) {
        if (isBlocked) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }
    
    function initialize() {
        setupIntersectionObserver();
        setupMutationObserver();
        
        // Prevent scrolling during block periods
        ['wheel', 'touchmove', 'keydown'].forEach(eventType => {
            window.addEventListener(eventType, preventScrollingDuringBlock, { passive: false, capture: true });
        });
        
        console.log('Twitter/X Scroll Inhibitor loaded! Now tracking tweets viewed.');
    }
    
    // Wait for page to load, then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
})();
