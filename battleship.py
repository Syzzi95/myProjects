from random import randint

board = []

for x in range(5):
  board.append(["O"] * 5)

def print_board(board):
  for row in board:
    print " ".join(row)

print_board(board)

def random_row(board):
  return randint(0, len(board) - 1)

def random_col(board):
  return randint(0, len(board[0]) - 1)

ship_row = random_row(board)
ship_col = random_col(board)

#two lines of code straight under is for debugging
#print ship_row
#print ship_col

# Everything from here on should go in your for loop!
# Be sure to indent four spaces!
def start_the_game(turns):
  for turn in range(turns): 
    guess_row = int(raw_input("Guess Row: "))
    guess_col = int(raw_input("Guess Col: "))

    if guess_row == ship_row and guess_col == ship_col:
      print "Congratulations! You sunk my battleship!"
      break
    else:
      if turn == turns: 
        print "Game Over"
      elif (guess_row < 0 or guess_row > 4) or (guess_col < 0 or guess_col > 4):
        print "Oops, that's not even in the ocean."
        print "Turn", (turn + 1)
      elif(board[guess_row-1][guess_col-1] == "X"):
        print "You guessed that one already."
        print "Turn", (turn + 1)
      else:
        print "You missed my battleship!"
        board[guess_row-1][guess_col-1] = "X"
        print "Turn", (turn + 1) 
        print_board(board)
  
start_the_game(10)
