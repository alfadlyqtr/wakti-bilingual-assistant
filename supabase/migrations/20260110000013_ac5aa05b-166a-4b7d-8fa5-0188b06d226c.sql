-- Fix the App.js file to make Heart icons visible by moving text-transparent to only the text
UPDATE project_files 
SET content = replace(
  content,
  '<motion.span 
              className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-rose-500 flex items-center justify-center gap-4"
              animate={{
                textShadow: [
                  ''0 0 10px rgba(236, 72, 153, 0.5), 0 0 20px rgba(168, 85, 247, 0.4)'',
                  ''0 0 20px rgba(236, 72, 153, 0.8), 0 0 30px rgba(168, 85, 247, 0.6)'',
                  ''0 0 10px rgba(236, 72, 153, 0.5), 0 0 20px rgba(168, 85, 247, 0.4)'',
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 5, 0], x: [0, -5, 3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Heart className="w-10 h-10 md:w-14 md:h-14 transform -scale-x-100" fill="currentColor" />
              </motion.div>
              {t(''title'')}
              <motion.div
                animate={{ rotate: [0, 10, -5, 0], x: [0, 5, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Heart className="w-10 h-10 md:w-14 md:h-14" fill="currentColor" />
              </motion.div>
            </motion.span>',
  '<motion.span 
              className="flex items-center justify-center gap-4"
            >
              <motion.div
                animate={{ rotate: [0, -10, 5, 0], x: [0, -5, 3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-pink-400"
              >
                <Heart className="w-10 h-10 md:w-14 md:h-14 transform -scale-x-100" fill="currentColor" />
              </motion.div>
              <motion.span
                className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-rose-500"
                animate={{
                  textShadow: [
                    ''0 0 10px rgba(236, 72, 153, 0.5), 0 0 20px rgba(168, 85, 247, 0.4)'',
                    ''0 0 20px rgba(236, 72, 153, 0.8), 0 0 30px rgba(168, 85, 247, 0.6)'',
                    ''0 0 10px rgba(236, 72, 153, 0.5), 0 0 20px rgba(168, 85, 247, 0.4)'',
                  ]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {t(''title'')}
              </motion.span>
              <motion.div
                animate={{ rotate: [0, 10, -5, 0], x: [0, 5, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-pink-400"
              >
                <Heart className="w-10 h-10 md:w-14 md:h-14" fill="currentColor" />
              </motion.div>
            </motion.span>'
)
WHERE project_id = '6265157e-c64c-404a-a699-5171b6ed2850' 
AND path = '/App.js';