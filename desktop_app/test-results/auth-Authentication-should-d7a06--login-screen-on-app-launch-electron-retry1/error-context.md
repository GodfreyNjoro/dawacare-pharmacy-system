# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - heading "Welcome to DawaCare POS" [level=1] [ref=e6]
    - paragraph [ref=e7]: Let's set up your database to get started
  - generic [ref=e8]:
    - generic [ref=e9]: "1"
    - generic [ref=e11]: "2"
    - generic [ref=e13]: "3"
  - generic [ref=e15]:
    - heading "Choose Your Database" [level=2] [ref=e16]
    - generic [ref=e17]:
      - generic [ref=e18] [cursor=pointer]:
        - radio "SQLite (Recommended) Zero configuration required. Perfect for single-location pharmacies or getting started quickly. ✓ No setup required ✓ File-based database ✓ Great for 1-3 users" [checked] [ref=e19]
        - generic [ref=e21]:
          - heading "SQLite (Recommended)" [level=3] [ref=e22]
          - paragraph [ref=e23]: Zero configuration required. Perfect for single-location pharmacies or getting started quickly.
          - list [ref=e24]:
            - listitem [ref=e25]: ✓ No setup required
            - listitem [ref=e26]: ✓ File-based database
            - listitem [ref=e27]: ✓ Great for 1-3 users
      - generic [ref=e28] [cursor=pointer]:
        - radio "PostgreSQL (Advanced) Powerful database for high-volume operations and multiple concurrent users. ✓ High performance ✓ Support for many concurrent users ✓ Advanced features ⚠ Requires PostgreSQL installation" [ref=e29]
        - generic [ref=e31]:
          - heading "PostgreSQL (Advanced)" [level=3] [ref=e32]
          - paragraph [ref=e33]: Powerful database for high-volume operations and multiple concurrent users.
          - list [ref=e34]:
            - listitem [ref=e35]: ✓ High performance
            - listitem [ref=e36]: ✓ Support for many concurrent users
            - listitem [ref=e37]: ✓ Advanced features
            - listitem [ref=e38]: ⚠ Requires PostgreSQL installation
  - generic [ref=e39]:
    - button "Back" [disabled] [ref=e40]
    - button "Next" [ref=e41] [cursor=pointer]
```